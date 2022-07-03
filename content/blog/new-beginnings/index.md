---
title: renderer
date: 2021-06-12 01:40:04
description: 介绍一下vue 和 react 的renderer设计
---

React 和 Vue 都使用vdom 来描述ui，这使得基于他们来实现跨平台就显得十分简单。比如React 使用react-dom将ui渲染到 dom上，使用react-native 将 ui渲染到 android / iOS 这样的原生平台上。<!-- more -->Vue2的实现中没有将平台相关的逻辑抽离出来，而Vue3则将平台无关的代码与平台相关的代码彻底分割开了，可以通过自定义渲染器将Vue3 渲染到任意平台。

Vue的渲染器 设计，可以看以前的[文章](https://colgin.github.io/2020/11/14/vue3-renderer/#more)

React 的渲染器是怎么设计的呢？我们知道 React通过 reconciler 来 决定如何更新host tree，reconciler 决定了是重新生成dom还是在现有内容上做一些修改。

react-reconciler 有两个工作模式

- mutation mode: 所有的 host instance 都是可以被修改的。react-dom就是这样的

```jsx
const view = createView()
updateView(view, { color: 'red' })
```

- persistent mode: 整个host tree都是 immutable的，更新就是重建一棵树

```jsx
view = createView()
view = cloneView(view, { color: 'red' })
```

一个渲染器包含了两部分内容。

- built-in component: dom 平台的 div, h1, react-native平台的 View, Text
- host config: 与host 相关的一些api，比如创建host instance等

此处我们仅仅讨论 渲染器的 host config部分。

在接口上，一个React渲染器只需要实现一个 供 Reconciler 调用的对象接口。

```jsx
const ReactDOMRenderer = Reconciler(ReactDOMHostConfig)
```

这个 ReactDOMHostConfig 就是一系列 与平台相关的 基础接口。在这里[react](https://github.com/facebook/react/blob/master/packages/react-reconciler/src/forks/ReactFiberHostConfig.custom.js)中可以看到完整的。

比如下面这个例子就实现了一个简单的dom 渲染器

```jsx
import ReactReconciler from 'react-reconciler'

ReactReconciler({
	// hostConfig
	supportsMutation: true, // mutation mode
	
	createInstance(type, props, rootContainerInstance, hostContext, internalInstanceHandle) {
		// 这里的type就是原生dom了，组件的处理已经在react 被处理完了
		const el = document.createElement(type)
		// 简单处理
		['alt', 'className', 'href', 'rel', 'src', 'target'].forEatch(k => {
			if (props[k]) el[k] = props[k]
		})

		if (props.onClick) {
			el.addEventListener('click', props.onClick)
		}
		// react 是平台无关的，这个返回值不是给react使用的，而是给hostConfig其他函数用的
		return el
	},
	createTextInstance(text, rootContianerInstance, hostContext, internalInstanceHandle) {
		return document.createTextNode(text)
	},

	apendChildToContainer(container, child) {
		container.appendChild(child)
	},
	appendChild(container, child) {
		container.appendChild(child)
	},
	appendInitialChild(container, child) {
		container.appendChild(child)
	},
	removeChildFromContainer(container, child) {
		container.removeChild(child)
	}
	removeChild(container, child) {
		container.removeChild(child)
	}
	insertInContainerBefore(container, child, before) {
		container.inserBefore(child, before)
	},
	insertBefore(container, child, before) {
		container.inserBefore(child, before)
	},
	// called in render phase
	prepareUpdate(instance, type, oldProps, newProps, rootContainerInstance, currentHostContext) {
		let payload
		if (oldProps.bgColor !== newProps.bgColor) {
			payload = { newBgColor: newProps.bgColor }
		}
		// 返回一个diff 结果，这个结果react 并不关心，是给下一个函数使用的
		return payload
	},
	// called in commit phase
	commitUpdate(instance, updatePayload, type, oldProps, newProps, rootContainerInstance, currentHostContext) {
		if (updatePayload.newBgColor) {
			instance.style.backgroundColor = updatePayload.newBgColor
		}
	}
})

let ReactDomMini = {
	render(comp, target) {
		// disabled concurrent mode and hydration
		let container = reconciler.createContainer(target, false, false)
		reconciler.updateContainer(comp, contaienr, null, null)
	}
}
```

以上代码参考自 [Building a Custom React Renderer | Sophie Alpert](youtube.com/watch?v=CGpMlWVcHok)

其实可以看到React 和 Vue3的渲染器api设计有一些不同，react是将参数丢给 reconciler，由 reconciler来实现调度。而Vue3则是没有 reconciler这一层，直接由hostConfig 生成 一套通用的 api，vue runtime 调用这一套通用的api实现渲染。

参考

- [Building a Custom React Renderer | Sophie Alpert](youtube.com/watch?v=CGpMlWVcHok)
- [Hello World Custom React Renderer](https://agent-hunt.medium.com/hello-world-custom-react-renderer-9a95b7cd04bc)
- [react-dom](ttps://github.com/facebook/react/blob/master/packages/react-dom/src/client/ReactDOMHostConfig.js)
- [React组件的本质](https://saul-mirone.github.io/zh-hans/the-essence-of-react-component/)
