---
title: Vue中的Portal技术
date: 2019-07-27 14:54:32
description: Portal是将组件渲染到任意位置的一种技术
---

## Vue 中的 Portal 技术

在 Vue 项目中，我们使用模板来声明 dom 嵌套关系，然而有时候一些组件需要脱离固定的层级关系，不再受制与层叠上下文，比如说 Modal 和 Dialog 这种组件就希望能够脱离当前模板所在的层叠上下文。

在 Vue 中有两种方式来实现这种效果，一种是使用指令，操作真实 dom，使用熟知的 dom 操作方法将指令所在的元素 append 到另外一个 dom 节点上去。另一种方式就是定义一套组件，将组件内的 vnode 转移到另外一个组件中去，然后各自渲染。

<!-- more -->

### 使用指令

典型的实现有[vue-dom-portal](https://github.com/calebroseland/vue-dom-portal),
[vux transfer](https://github.com/airyland/vux/blob/v2/src/directives/transfer-dom/index.js),
[iview transfer](https://github.com/iview/iview/blob/2.0/src/directives/transfer-dom.js)

这里以[vue-dom-portal](https://github.com/calebroseland/vue-dom-portal)为例，代码非常简单无非就是将当前的 dom 移动到指定地方

```js
/**
 * Get target DOM Node
 * @param {(Node|string|Boolean)} [node=document.body] DOM Node, CSS selector, or Boolean
 * @return {Node} The target that the el will be appended to
 */
function getTarget(node = document.body) {
  if (node === true) return document.body;
  return node instanceof window.Node ? node : document.querySelector(node);
}

const homes = new Map();

const directive = {
  inserted(el, { value }, vnode) {
    const { parentNode } = el;
    const home = document.createComment("");
    let hasMovedOut = false;

    if (value !== false) {
      parentNode.replaceChild(home, el); // moving out, el is no longer in the document
      getTarget(value).appendChild(el); // moving into new place
      hasMovedOut = true;
    }

    if (!homes.has(el)) homes.set(el, { parentNode, home, hasMovedOut }); // remember where home is or should be
  },
  componentUpdated(el, { value }) {
    // need to make sure children are done updating (vs. `update`)
    const { parentNode, home, hasMovedOut } = homes.get(el); // recall where home is

    if (!hasMovedOut && value) {
      // remove from document and leave placeholder
      parentNode.replaceChild(home, el);
      // append to target
      getTarget(value).appendChild(el);

      homes.set(el, Object.assign({}, homes.get(el), { hasMovedOut: true }));
    } else if (hasMovedOut && value === false) {
      // previously moved, coming back home
      parentNode.replaceChild(el, home);
      homes.set(el, Object.assign({}, homes.get(el), { hasMovedOut: false }));
    } else if (value) {
      // already moved, going somewhere else
      getTarget(value).appendChild(el);
    }
  },
  unbind(el, binding) {
    homes.delete(el);
  }
};

function plugin(Vue, { name = "dom-portal" } = {}) {
  Vue.directive(name, directive);
}

plugin.version = "0.1.6";

export default plugin;

if (typeof window !== "undefined" && window.Vue) {
  window.Vue.use(plugin);
}
```

可以看到在 inserted 的时候就拿到实例的 el（真实 dom），然后进行替换操作，在 componentUpdated 的时候再次根据指令的值去操作 dom。为了能够在不同声明周期函数中使用缓存的一些数据，这里在 inserted 的时候就把当前节点的父节点和替换成的 dom 节点（一个注释节点）,以及节点是否移出去的状态都记录在外部的一个 map 中，这样可以在其他的声明周期函数中使用，可以避免重复计算。

类似的还有[iview transfer](https://github.com/iview/iview/blob/2.0/src/directives/transfer-dom.js)，略微有些不同的是，共享的一些状态变量是挂载在 el 的属性上面。

### 使用组件对

典型地是[portal-vue](https://github.com/LinusBorg/portal-vue)，声明了一对组件 Portal,PortalTarget。在 portal 中指定 name，可以将 portal 里的内容转移到具有相同 name 的 PortalTarget 中显示。原理就是在 mounted, updated 的时候将 Portal 的 vnode 存到一个公共空间，然后重写 Portal 的 render 函数，PortalTarget 在渲染时则是去公共空间中去寻找符合条件的 vnode，将其渲染出来。

有一个简化版本[simple-portal-vue](https://github.com/ziyoung/simple-portal-vue)利于理解，这个公共空间就是一个 vue 实例。

```js
// wormhole.js 公共空间
import Vue from "vue";

const Wormhole = Vue.extend({
  data() {
    return {
      transports: {}
    };
  },
  methods: {
    open(transport) {
      const { to, passengers } = transport;
      transport.passengers = Object.freeze(passengers);
      if (!this.transports[to]) {
        Vue.set(this.transports, to, []);
      }

      const currentIndex = this.getTransportIndex(transport);
      const newTransports = [...this.transports[to]];
      if (currentIndex === -1) {
        newTransports.push(transport);
      } else {
        newTransports[currentIndex] = transport;
      }
      this.transports[to] = newTransports;
    },
    close(transport, force = false) {
      const { to } = transport;
      if (!this.transports[to]) {
        return;
      }

      if (force) {
        this.transports[to] = [];
      } else {
        const index = this.getTransportIndex(transport);
        if (index !== -1) {
          const newTransports = [...this.transports[to]];
          newTransports.splice(index, 1);
          this.transports[to] = newTransports;
        }
      }
    },
    getTransportIndex({ to, from }) {
      return this.transports[to].findIndex(
        transport => transport.from === from
      );
    }
  }
});

const wormhole = new Wormhole();

export default wormhole;
```

这个导出的 wormhole 对象是唯一的，不同 portal，portal-target 读取到的数据都是同一份。这里利用了 vue 实例的响应式，将对应关系都存在 data 的 transports 里面。

```js
// portal.js
import wormhole from "./wormhole";

let pid = 1;

export default {
  name: "portal",
  props: {
    to: {
      type: String,
      required: true
    },
    name: {
      type: String,
      default() {
        return String(pid++);
      }
    }
  },
  mounted() {
    this.sendUpdate();
  },
  updated() {
    this.sendUpdate();
  },
  beforeDestroy() {
    this.clear();
  },
  methods: {
    normalizedSlots() {
      return this.$scopedSlots.default
        ? [this.$scopedSlots.default]
        : this.$slots.default;
    },
    sendUpdate() {
      const slotContent = this.normalizedSlots();
      if (slotContent) {
        wormhole.open({
          from: this.name,
          to: this.to,
          passengers: [...slotContent]
        });
      } else {
        this.clear();
      }
    },
    clear() {
      wormhole.close({
        from: this.name,
        to: this.to
      });
    }
  },
  render() {
    return <div class="v-portal" style="display: none;" />;
  }
};
```

在 portal 组件里，在 mounted 和 updated 的时候都会将 portal 组件里的内容经过整理后传给 wormhole 实例，所谓的整理好的内容其实就是组件的插槽里面的内容，类型是 Function[] | VNode[], 作用域插槽是一个 Function，普通的插槽是 VNode。参考[vue api 文档](https://cn.vuejs.org/v2/api/)

```js
// portal-target.js
import wormhole from "./wormhole";

export default {
  name: "portalTarget",
  props: {
    multiple: Boolean,
    slotProps: Object,
    name: {
      type: String,
      required: true
    }
  },
  created() {
    if (!this.transports[this.name]) {
      this.$set(this.transports, this.name, []);
    }
  },
  data() {
    return {
      transports: wormhole.transports
    };
  },
  computed: {
    ownTransports() {
      const transports = this.transports[this.name] || [];
      if (this.multiple) {
        return transports;
      } else {
        return transports.slice(-1);
      }
    },
    passengers() {
      const slotProps = this.slotProps || {};
      return this.ownTransports.reduce((passengers, transport) => {
        let newPassenger = transport.passengers[0];
        if (typeof newPassenger === "function") {
          newPassenger = newPassenger(slotProps);
        } else {
          newPassenger = transport.passengers;
        }

        return passengers.concat(newPassenger);
      }, []);
    }
  },
  methods: {
    children() {
      return this.passengers.length === 0
        ? this.$slots.default
        : this.passengers;
    }
  },
  render() {
    const children = this.children();
    // Solves a bug where Vue would sometimes duplicate elements upon changing multiple or disabled
    const wrapperKey = this.ownTransports.length;
    return (
      <div class="portal-target" key={wrapperKey}>
        {children}
      </div>
    );
  }
};
```

在 portal-target 里面要做的事情就是从 wormhole 里面把 name 值匹配的 vnode 取出来，然后把它渲染成一个 vnode 数组。普通插槽直接就是 vnode 数组，作用域插槽的值是一个函数，传入参数就可以转化为 vnode，然后在 render 函数中将这些 vnode 渲染出来即可。

上面这个例子很好地说明了 Portal-Vue 工作的原理，而真正的 Portal-Vue 还支持更加多的功能。而且 wormhole 不仅支持以一个实例导出，也支持以类的形式导出，这给了使用者更多的自由，而且所有的 Wormhole 实例都共享了一份数据。

```js
const transports = {}
const targets = {}
const sources = {}

export const Wormhole = Vue.extend({
  data: () => ({
    transports,
    targets,
    sources
  }),
  methods: {
    open() {},
    close() {}
  }
}

const wormhole = new Wormhole()
export { wormhole }
```

#### 总结

这两种方式各有长处，以组件形式实现的 Portal，功能比较多，而且灵活，但是要求使用者在模板中写两个组件，比较适合与比较复杂的业务场景。以指令形式实现的 Portal 功能相对简单，但是使用起来比较简单，只需要在需要迁移的节点上写上指令既可，比较适合在组件库中，因为你无法要求组件库的使用者在某某地方写一个 Portal-Target，而且组件库中一般就是将节点迁移到根节点中，形式比较固定。

参考：

- [vue-dom-portal](https://github.com/calebroseland/vue-dom-portal)
- [vux transfer](https://github.com/airyland/vux/blob/v2/src/directives/transfer-dom/index.js)
- [iview transfer](https://github.com/iview/iview/blob/2.0/src/directives/transfer-dom.js)
- [portal-vue](https://github.com/LinusBorg/portal-vue)
- [simple-portal-vue](https://github.com/ziyoung/simple-portal-vue)
