---
title: Vue3中的组件更新
date: 2021-03-07 15:52:06
description: 没有类似React的shouldComponentUpdate钩子，Vue是如何做到自动更新的？
---

Vue与React有一个很大的区别在于组件更新的策略 ，Vue能够根据组件定义自行判断需不需要执行组件的更新而React在不进行任何优化的前提是，是无脑进行更新。如果开发者需要控制更新时机，可以通过自行的定义shouldComponentUpdate, React.memo等方式来让组件在必要的时候进行更新。可以说React 本身做的更少，将更多的优化空间交给了开发者，而Vue 本身就实现了比较优秀的更新策略。

这篇文章，我们将深入Vue3源码探索。

在父组件更新的时候，会递归执行patch，如果遇到组件会执行updateComponent。

```typescript
  const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
    const instance = (n2.component = n1.component)!
    if (shouldUpdateComponent(n1, n2, optimized)) {
      if (
        __FEATURE_SUSPENSE__ &&
        instance.asyncDep &&
        !instance.asyncResolved
      ) {
        // async & still pending - just update props and slots
        // since the component's reactive effect for render isn't set-up yet
        if (__DEV__) {
          pushWarningContext(n2)
        }
        updateComponentPreRender(instance, n2, optimized)
        if (__DEV__) {
          popWarningContext()
        }
        return
      } else {
        // normal update
        instance.next = n2
        // in case the child component is also queued, remove it to avoid
        // double updating the same child component in the same flush.
        invalidateJob(instance.update)
        // instance.update is the reactive effect runner.
        instance.update()
      }
    } else {
      // no update needed. just copy over properties
      n2.component = n1.component
      n2.el = n1.el
      instance.vnode = n2
    }
  }
```

这里n1，n2是组件VNode。可以看到通过 `shouldComponentUpdate` 方法来确定是否需要更新组件，如果不需要更新的话，直接将el（dom）和 instance 的关系绑定到新的VNode就行，如果需要更新的话，就会去执行 `instance.update` 方法，在这个方法中，会重新执行组件的render方法，生成新的 `subtree` 。

这里，可以简单看下 `instance.update `的定义，当然这不是本文的重点。

```typescript
const prodEffectOptions = {
  scheduler: queueJob,
  // #1801, #2043 component render effects should allow recursive updates
  allowRecurse: true
}
const setupRenderEffect: SetupRenderEffectFn = (
  instance,
  initialVNode,
  container,
  anchor,
  parentSuspense,
  isSVG,
  optimized
) => {
  // create reactive effect for rendering
  instance.update = effect(function componentEffect() {
    if (!instance.isMounted) {
      let vnodeHook: VNodeHook | null | undefined
      const { el, props } = initialVNode
      const { bm, m, parent } = instance

      // beforeMount hook
      if (bm) {
        invokeArrayFns(bm)
      }
      // onVnodeBeforeMount
      if ((vnodeHook = props && props.onVnodeBeforeMount)) {
        invokeVNodeHook(vnodeHook, parent, initialVNode)
      }
      const subTree = (instance.subTree = renderComponentRoot(instance))

      if (el && hydrateNode) {
				// dydrate
      } else {
        patch(
          null,
          subTree,
          container,
          anchor,
          instance,
          parentSuspense,
          isSVG
        )
        initialVNode.el = subTree.el
      }
      // mounted hook
      if (m) {
        queuePostRenderEffect(m, parentSuspense)
      }
      // onVnodeMounted
      if ((vnodeHook = props && props.onVnodeMounted)) {
        const scopedInitialVNode = initialVNode
        queuePostRenderEffect(() => {
          invokeVNodeHook(vnodeHook!, parent, scopedInitialVNode)
        }, parentSuspense)
      }
      // activated hook for keep-alive roots.
      // #1742 activated hook must be accessed after first render
      // since the hook may be injected by a child keep-alive
      const { a } = instance
      if (
        a &&
        initialVNode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      ) {
        queuePostRenderEffect(a, parentSuspense)
      }
      instance.isMounted = true

      // #2458: deference mount-only object parameters to prevent memleaks
      initialVNode = container = anchor = null as any
    } else {
      // updateComponent
      // This is triggered by mutation of component's own state (next: null)
      // OR parent calling processComponent (next: VNode)
      let { next, bu, u, parent, vnode } = instance
      let originNext = next
      let vnodeHook: VNodeHook | null | undefined

      if (next) {
        next.el = vnode.el
        updateComponentPreRender(instance, next, optimized)
      } else {
        next = vnode
      }

      // beforeUpdate hook
      if (bu) {
        invokeArrayFns(bu)
      }
      // onVnodeBeforeUpdate
      if ((vnodeHook = next.props && next.props.onVnodeBeforeUpdate)) {
        invokeVNodeHook(vnodeHook, parent, next, vnode)
      }

      const nextTree = renderComponentRoot(instance)
      const prevTree = instance.subTree
      instance.subTree = nextTree

      patch(
        prevTree,
        nextTree,
        // parent may have changed if it's in a teleport
        hostParentNode(prevTree.el!)!,
        // anchor may have changed if it's in a fragment
        getNextHostNode(prevTree),
        instance,
        parentSuspense,
        isSVG
      )
      next.el = nextTree.el
      if (originNext === null) {
        // self-triggered update. In case of HOC, update parent component
        // vnode el. HOC is indicated by parent instance's subTree pointing
        // to child component's vnode
        updateHOCHostEl(instance, nextTree.el)
      }
      // updated hook
      if (u) {
        queuePostRenderEffect(u, parentSuspense)
      }
      // onVnodeUpdated
      if ((vnodeHook = next.props && next.props.onVnodeUpdated)) {
        queuePostRenderEffect(() => {
          invokeVNodeHook(vnodeHook!, parent, next!, vnode)
        }, parentSuspense)
      }
    }
  }, prodEffectOptions)
}
```

外部props发生变化，会将新的组件VNode赋值给实例的next属性，然后进入 `instance.update ` 函数， `next` 属性是否有值是区分外部props变化导致组件渲染还是组件内部状态变化导致的渲染的 重要条件。之后，会重新渲染实例，拿到subtree （组件内部的VNode），然后进行patch。

此时，我们再回到 `updateComponent`函数中 `shouldUpdateComponent` 中，可以看到Vue 中递归向下更新的时候，是如何确定一个组件是否需要更新。

```typescript
export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode,
  optimized?: boolean
): boolean {
  const { props: prevProps, children: prevChildren, component } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  const emits = component!.emitsOptions

  // Parent component's render function was hot-updated. Since this may have
  // caused the child component's slots content to have changed, we need to
  // force the child to update as well.
  if (__DEV__ && (prevChildren || nextChildren) && isHmrUpdating) {
    return true
  }

  // force child update for runtime directive or transition on component vnode.
  if (nextVNode.dirs || nextVNode.transition) {
    return true
  }

  if (optimized && patchFlag >= 0) {
    if (patchFlag & PatchFlags.DYNAMIC_SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & PatchFlags.FULL_PROPS) {
      if (!prevProps) {
        return !!nextProps
      }
      // presence of this flag indicates props are always non-null
      return hasPropsChanged(prevProps, nextProps!, emits)
    } else if (patchFlag & PatchFlags.PROPS) {
      const dynamicProps = nextVNode.dynamicProps!
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if (
          nextProps![key] !== prevProps![key] &&
          !isEmitListener(emits, key)
        ) {
          return true
        }
      }
    }
  } else {
    // this path is only taken by manually written render functions
    // so presence of any children leads to a forced update
    if (prevChildren || nextChildren) {
      if (!nextChildren || !(nextChildren as any).$stable) {
        return true
      }
    }
    if (prevProps === nextProps) {
      return false
    }
    if (!prevProps) {
      return !!nextProps
    }
    if (!nextProps) {
      return true
    }
    return hasPropsChanged(prevProps, nextProps, emits)
  }

  return false
}
```

```typescript
function hasPropsChanged(
  prevProps: Data,
  nextProps: Data,
  emitsOptions: ComponentInternalInstance['emitsOptions']
): boolean {
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (
      nextProps[key] !== prevProps[key] &&
      !isEmitListener(emitsOptions, key)
    ) {
      return true
    }
  }
  return false
}
```



这里 `patchFlag` 是 对VNode 的描述，用来表示VNode 哪一部分会发生变化。

在上文中，如果VNode上有指令或者 transition，会进行更新。

如果有动态插槽，会进行更新，因为插槽里可能引用了父组件的数据。

如果VNode是 `FULL_PROPS` 时，下面几种情况都是 `FULL_PROPS`

```html
<div v-bind="foo" />
<div :[foo]="bar" />
<div id="foo" v-bind="bar" :class="cls" />
```

会对比前后的props，决定是否需要更新。

如果VNode是 `PROPS` ，这是最常规的类型，可以在 `dynamicProps` 中 找到 可能发生变化的props，对这些prop 挨个进行比较，如果不一样，就更新。

上面的比较是针对使用模板的情况下，因为使用模板，compiler 可以根据模板给VNode提供诸如 patchFlags, dynamicProps这种编译时信息，以减少后期的diff 成本。而如果是用户手写Render 函数，这种信息是一般是没有的。这种情况下，就只能对前后props一个一个进行比较了，如果任何一个发生变化，就更新，如果都没有发生变化则不更新。
