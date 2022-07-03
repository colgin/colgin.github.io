---
title: 动态获取元素的宽度
date: 2021-06-27 08:41:36
description: 简单的动态获取元素的宽度的需求会有哪些坑点呢？
---



最近在实现一个需求的时候，需要实时获取元素的宽度，写着觉得比较有意思，特此记录思考和分析的过程。<!--more-->

## 背景

最小的例子如下

```html
<template>
  <div class="hello">
    <span style="outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
</template>

<script>
import { ref } from 'vue'
export default {
  name: "AutoWidth",

  setup() {
    const name = ref('')
    const contentWidth = ref(0)

    return {
      name,
      contentWidth
    }
  },
};
</script>
```

在输入框输入内容，在`span`中可以显示内容，在`p`标签中能自动更新`span` 标签的宽度。以下例子均以vue3为例。大部分内容可以兼容vue2，在Vue2中ref不可以是函数，所以最后一个方案是不适用的，其他方案vue2也适用，只不过可能有少量api的兼容问题。

## 错误示范

有人会这样写

```html
<template>
  <div class="hello">
    <span ref="spanRef" style="outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
</template>

<script>
import { watch, ref } from 'vue'
export default {
  name: "AutoWidth",

  setup() {
    const name = ref('')
    const contentWidth = ref(0)
    const spanRef = ref(null)

    watch(spanRef, (el) => {
      if (el) {
        contentWidth.value = el.offsetWidth
      }
    }, { flush: 'post', immediate: true })

    return {
      name,
      spanRef,
      contentWidth,
    }
  },
};
</script>
```

这样是不行的，原因很简单，`spanRef` 在第一次渲染的时候被赋值了，后面 `name` 发生变化，由于 `span` 执行更新操作，所以 `spanRef`并不会被重新赋值。

## 解决方案

### 使用生命周期

这是最容易想到的方案，在`mounted` 和`updated` 的时候重新算一下元素的宽度。

```html
<template>
  <div class="hello">
    <span ref="spanRef" style="outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
</template>

<script>
import { onMounted, onUpdated, ref } from 'vue'
export default {
  name: "AutoWidth",

  setup() {
    const name = ref('')
    const contentWidth = ref(0)
    const spanRef = ref(null)

    const getWidth = () => {
      contentWidth.value = spanRef.value?.offsetWidth
    }

    onMounted(() => {
      getWidth()
    })

    onUpdated(() => {
      getWidth()
    })

    return {
      name,
      spanRef,
      contentWidth
    }
  },
};
</script>
```

这种方案监听组件的生命周期，如果组件的其他状态变量导致组件更新，也会触发updated回调。

比如下面

```html
<template>
  <div class="hello">
    <span ref="spanRef" style="outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
  <h4 v-if="show">some content</h4>
</template>

<script>
import { onMounted, onUpdated, ref } from 'vue'
export default {
  name: "AutoWidth",

  setup() {
    const name = ref('')
    const contentWidth = ref(0)
    const spanRef = ref(null)
    const show = ref(false)
    setTimeout(() => {
      show.value = !show.value
    }, 5000)

    const getWidth = () => {
      contentWidth.value = spanRef.value?.offsetWidth
    }

    onMounted(() => {
      getWidth()
    })

    onUpdated(() => {
      getWidth()
    })

    return {
      name,
      spanRef,
      contentWidth,
      show
    }
  },
};
</script>
```

`show` 的变化导致了重新渲染，也会重新取span的offset，但是我们很容易知道 `span` 内容并没有发生变化。这就导致了多余的计算了。

我们可以监听会导致 `span` 元素宽度变化的变量，每次这些变量变化的时候，重新算一下。

```html
<template>
  <div class="hello">
    <span ref="spanRef" style="outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
export default {
  name: "AutoWidth",

  setup() {
    const name = ref('')
    const contentWidth = ref(0)
    const spanRef = ref(null)

    const getWidth = () => {
      contentWidth.value = spanRef.value?.offsetWidth
    }
    watch(name, () => {
      getWidth()
    }, { immediate: true, flush: 'post' })

    return {
      name,
      spanRef,
      contentWidth,
    }
  },
};
</script>
```

这里要将 watch的`flush` 设置为 `true` , 这样回调才会在dom渲染后被调用。这个方案的问题在于，你要去分析哪些状态会影响 该元素的宽度，这在比较复杂一些的场景就会让人头疼。

也可以使用 `ResizeObserver` 来监听dom。文档参考[MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/ResizeObserver)

```html
<template>
  <div class="hello">
    <span ref="spanRef" style="display: inline-block;outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
</template>

<script>
import { onBeforeUnmount, ref, watch } from 'vue'
export default {
  name: "AutoWidth",

  setup() {
    const name = ref('')
    const contentWidth = ref(0)
    const spanRef = ref(null)

    let observer
    watch(spanRef, (el) => {
      observer = new window.ResizeObserver((entries) => {
        contentWidth.value = entries[0].contentRect.width
      })
      if (el) {
        observer.observe(el)  
      }
    }, { immediate: true, flush: 'post' })
    onBeforeUnmount(() => {
      observer.disconnect()
    })


    return {
      name,
      spanRef,
      contentWidth,
    }
  },
};
</script>
```

使用`ResizeObserber` 一定要注意，要将行内元素要设置为 `display: inline-block`。 这个方案的缺点在于 `ResizeObserver` 是一个实验性的功能，在 [can i use](https://caniuse.com/resizeobserver) 可以看到现代浏览器基本都支持，IE是不支持的。



### 使用指令

Vue的指令可以定义元素 的 `updated`, `monuted` 回调。

```html
<template>
  <div class="hello">
    <span ref="spanRef" v-size="onSizeChange" style="outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
</template>

<script>
import { ref } from 'vue'
export default {
  name: "AutoWidth",

  directives: {
    size: {
      mounted(el, binding) {
        binding.value(el.offsetWidth)
      },
      updated(el, binding) {
        binding.value(el.offsetWidth)
      }
    }
  },

  setup() {
    const name = ref('')
    const contentWidth = ref(0)
    const spanRef = ref(null)

    const onSizeChange = (width) => {
      contentWidth.value = width
    }


    return {
      name,
      spanRef,
      contentWidth,
      onSizeChange
    }
  },
};
</script>
```



### 使用ref函数

在Vue3中 ref可以穿入一个函数，元素初次渲染或者元素更新都会调用这个回调

```html
<template>
  <div class="hello">
    <span :ref="spanRef" style="outline: 1px solid red">{{ name }}</span>
    <input v-model="name" />
    <p>width: {{ contentWidth }}</p>
  </div>
</template>

<script>
import { ref } from 'vue'
export default {
  name: "AutoWidth",

  setup() {
    const name = ref('')
    const contentWidth = ref(0)
    const spanRef = (el) => {
      contentWidth.value = el.offsetWidth
    }

    return {
      name,
      spanRef,
      contentWidth,
    }
  },
};
</script>
```

这样也可以获取到宽度。



## Composition API

上面的第一种方案，可以独立封装成 Composition API, 比较简单，故此处不做更多讲解。
