---
title: vue3 中渲染器api的设计
date: 2020-11-14 23:54:03
description: 良好的API设计是将vue接入各种平台的基础
---

vue2的代码中将vdom渲染成dom的方法封装在内部，如果要将vue渲染到其他一些平台，从代码组织上就很啰嗦。比如[mp-vue](https://github.com/Meituan-Dianping/mpvue)就是直接从fork了一份vue的代码，然后修改渲染vdom的那部分代码。比如weex因为和vue有合作，所以代码是直接放在vue里的[platform](https://github.com/vuejs/vue/tree/dev/src/platforms/weex)目录下。而vue3则彻底将运行时和将vdom渲染到页面上的平台相关代码进行了分离。从代码的组织上就能看出来了，runtime-core是平台无关的运行时，runtime-dom是和dom相关的api，除了vue实现的dom 平台之外，vue还将api设计成友好的可拓展的方式，可以让开发者自定义渲染器。所以本文将从源码解析vue 关于渲染器部分的api设计与实现。
<!--more-->

首先来看下，如何在web页面上渲染一个app

```jsx
const Counter = {
  data() {
    return {
      counter: 0
    }
  }
}

Vue.createApp(Counter).mount('#counter')
```

```jsx
new Vue({
  el: '#counter',
  render: (h) => <Counter />
})
```

vue3的api设计也和vue2 有很大的区别

vue3 引入了一个新的 概念application，通过createApp可以创建一个application，然后可以在application上可以注册这个application上全局的指令。

通过源码，可以看到

```jsx
export const createApp = ((...args) => {
  const app = ensureRenderer().createApp(...args)

  if (__DEV__) {
    injectNativeTagCheck(app)
  }

  const { mount } = app
  app.mount = (containerOrSelector: Element | string): any => {
    const container = normalizeContainer(containerOrSelector)
    if (!container) return
    const component = app._component
    if (!isFunction(component) && !component.render && !component.template) {
      component.template = container.innerHTML
    }
    // clear content before mounting
    container.innerHTML = ''
    const proxy = mount(container)
    container.removeAttribute('v-cloak')
    container.setAttribute('data-v-app', '')
    return proxy
  }

  return app
}) as CreateAppFunction<Element>
```

这里通过调用ensureRenderer() 返回一个渲染器，然后调用渲染器的createApp方法得到app，然后重写app的mount方法。

所以在vue里渲染器是什么呢？可以看看ensureRender()函数

```jsx
// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
let renderer: Renderer<Element> | HydrationRenderer

function ensureRenderer() {
  return renderer || (renderer = createRenderer<Node, Element>(rendererOptions))
}

const rendererOptions = extend({ patchProp, forcePatchProp }, nodeOps)
```

这里的渲染器就是通过createRenderer函数创建的，传递的参数 是 一些操作dom的方法，比如nodeOps

```jsx
const nodeOps = {
    insert() {},
    remove() {},
    createElement() {},
    createText() {},
    createComment() {},
    setText() {},
    setElementText() {},
    parentNode() {},
    nextSibling() {},
    querySelector() {},
    setScopeId() {},
    cloneNode() {},
    insertStaticContent() {}
}
```

都是一些常规的操作dom的方法。

再看下createRenderer的实现，在runtime-core包里面

```jsx
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options)
}
```

createRenderer函数是被导出的，可以提供给开发者使用。这也是我们自定义渲染器需要使用的方法。接下来看下baseCreateRenderer的实现

```jsx
function baseCreateRender(options, createHydrationFns) {
    const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    forcePatchProp: hostForcePatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    cloneNode: hostCloneNode,
    insertStaticContent: hostInsertStaticContent
  } = options
    // ...
    
    const render = (vnode, contianer) => {
        //
    }
    let hydrate: ReturnType<typeof createHydrationFunctions>[0] | undefined
  let hydrateNode: ReturnType<typeof createHydrationFunctions>[1] | undefined
  if (createHydrationFns) {
    ;[hydrate, hydrateNode] = createHydrationFns(internals as RendererInternals<
      Node,
      Element
    >)
  }

    return {
        render,
        hydrate,
        createApp: createAppAPI(render, hydrate)
    }
}
```

这里可以看到，baseCreateRenderer 函数没有导出，这是因为这是通用的渲染器定义，在这个函数 返回了三个方法

- render: 将vnode渲染到指定容器中
- hydrate: ssr相关
- createApp: 创建应用

在这个函数中，从options对象中取出操作dom的那些方法，然后得到一个render 函数，这个render 函数作用就是将vnode 渲染到指定的节点上，这其中就会利用options传过来的那些原生dom方法。

可以看到一个渲染器包含了 render,hydrate,createApp三个部分。

我们再看下createApp的实现

```jsx
export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }

    const context = createAppContext()
    const installedPlugins = new Set()

    let isMounted = false

    const app: App = (context.app = {
      _uid: uid++,
      _component: rootComponent as ConcreteComponent,
      _props: rootProps,
      _container: null,
      _context: context,

      version,

      get config() {
        return context.config
      },

      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },

      use(plugin: Plugin, ...options: any[]) {
        if (installedPlugins.has(plugin)) {
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`
          )
        }
        return app
      },

      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
            // global mixin with props/emits de-optimizes props/emits
            // normalization caching.
            if (mixin.props || mixin.emits) {
              context.deopt = true
            }
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
                (mixin.name ? `: ${mixin.name}` : '')
            )
          }
        } else if (__DEV__) {
          warn('Mixins are only available in builds supporting Options API')
        }
        return app
      },

      component(name: string, component?: Component): any {
        if (__DEV__) {
          validateComponentName(name, context.config)
        }
        if (!component) {
          return context.components[name]
        }
        if (__DEV__ && context.components[name]) {
          warn(`Component "${name}" has already been registered in target app.`)
        }
        context.components[name] = component
        return app
      },

      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          validateDirectiveName(name)
        }

        if (!directive) {
          return context.directives[name] as any
        }
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        context.directives[name] = directive
        return app
      },

      mount(rootContainer: HostElement, isHydrate?: boolean): any {
        if (!isMounted) {
          const vnode = createVNode(
            rootComponent as ConcreteComponent,
            rootProps
          )
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          // HMR root reload
          if (__DEV__) {
            context.reload = () => {
              render(cloneVNode(vnode), rootContainer)
            }
          }

          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            render(vnode, rootContainer)
          }
          isMounted = true
          app._container = rootContainer
          // for devtools and telemetry
          ;(rootContainer as any).__vue_app__ = app

          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            devtoolsInitApp(app, version)
          }

          return vnode.component!.proxy
        } else if (__DEV__) {
          warn(
            `App has already been mounted.\n` +
              `If you want to remount the same app, move your app creation logic ` +
              `into a factory function and create fresh app instances for each ` +
              `mount - e.g. \`const createMyApp = () => createApp(App)\``
          )
        }
      },

      unmount() {
        if (isMounted) {
          render(null, app._container)
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            devtoolsUnmountApp(app)
          }
        } else if (__DEV__) {
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },

      provide(key, value) {
        if (__DEV__ && (key as string | symbol) in context.provides) {
          warn(
            `App already provides property with key "${String(key)}". ` +
              `It will be overwritten with the new value.`
          )
        }
        // TypeScript doesn't allow symbols as index type
        // https://github.com/Microsoft/TypeScript/issues/24587
        context.provides[key as string] = value

        return app
      }
    })

    return app
  }
}
```

前面我们说到 vue3 与vue2有一个很大的区别在于，vue3引入了application的概念，在createAppAPI这里可以看到，返回的app就是一个application对象，这个对象实现了 集成注册插件，注册指令，注册组件等方法，实现都很简单，就是将这些资源的注册到app 的context中而不是像vue3那样注册到全局Vue中。

这个createAppAPI 里有一个mount方法 就是将application 挂载到某一个dom节点上，实现上就是利用之前的render 方法。

看到这里，或许你对vue3渲染器的API设计与实现已经有一部分了解了。接下来说一些有意思的点。

1. render方法

在runtime-dom中 对渲染器的render方法是暴露给了开发者的。

```jsx
// use explicit type casts here to avoid import() calls in rolled-up d.ts
export const render = ((...args) => {
  ensureRenderer().render(...args)
}) as RootRenderFunction<Element>
```

而这个render方法 的实现就是 渲染器里面的render方法，作用就是将vdom渲染到固定容器中。也就是说如下代码也是可以渲染出来的。

```jsx
import { h } from 'vue'
import App from './App.vue'

render(h(App), document.getElementById('app'))
```

而实际使用过程，我们大都使用createApp创建一个application这种方式，原因是这种方式更加符合vue3的设计，将资源注册到application 会让代码更加模块化。

render方法在测试中会有很多应用

```jsx
import { createStaticVNode, h, render } from '../src'

describe('static vnode handling', () => {
  const content = `<div>hello</div><p>world</p>`
  const content2 = `<p>foo</p><div>bar</div><span>baz</span>`

  const s = createStaticVNode(content, 2)
  const s2 = createStaticVNode(content2, 3)

  test('should mount from string', () => {
    const root = document.createElement('div')
    render(h('div', [s]), root)
    expect(root.innerHTML).toBe(`<div>${content}</div>`)
  })
})
```

2. 如何实现一个渲染器

根据vue 的api设计，我们只需要传入一组 操作原生 内容的api，就可以得到一个针对特定平台的渲染器

```jsx
import { createRenderer, h } from 'vue'
// 参考runtime-dom/src/nodeOps.ts
const options = {
    insert() {},
    remove() {},
    createElement() {},
    createText() {},
    createComment() {},
    setText() {},
    setElementText() {},
    parentNode() {},
    nextSibling() {},
    querySelector() {},
    setScopeId() {},
    cloneNode() {},
    insertStaticContent() {},
    patchProp() {},
    forcePatchProp() {}
}

let myRenderer
function ensureMyRenderer() {
    return myRenderer || (myRenderer = createRenderer(options))
}

function createMyRendererApp(...args) {
    const app = ensureMyRenderer().createApp(...args)

    // 重写mount
    const { mount } = app
    app.mount = (containerOrSelector) => {
        // ..
        const proxy = mount(container)
        return proxy
    }
}

createMyRendererApp(h(<App />), 'app')
```
