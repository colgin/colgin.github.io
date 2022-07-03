---
title: css-in-js 介绍
date: 2021-01-25 01:33:25
description: 为什么css-in-js 能这么🔥呢？
---

css-in-js 是web开发中css的一个解决方案，本文将做此方案进行简要的分析。

<!--more-->

## 关注点分离

关注点分离（separation of concerns）是对只与“特定概念、目标”（关注点）相关联的软件组成部分进行“标识、封装和操纵”的能力，即标识、封装和操纵关注点的能力。是处理复杂性的一个原则。由于关注点混杂在一起会导致复杂性大大增加，所以能够把不同的关注点分离开来，分别处理就是处理复杂性的一个原则，一种方法（来自[wikipedia](https://zh.wikipedia.org/wiki/关注点分离)）

针对web开发的场景，就是将负责结构的HTML，负责样式的CSS，负责逻辑的的JS三种不同的技术进行分离。

然后随着Vue，React一些框架的出现，组件的概念被提出，一个组件里往往封装了结构，样式，逻辑，其内部是耦合的。对关注点分离的理解也已经不再是根据不同类型进行分离，而是用组件将耦合的三者打包在一起，使用组件进行隔离，使得代码更容易维护和组织。Vue在这一点上尤为明显，使用SFC来书写组件。参考[vue中的关注点分离](https://cn.vuejs.org/v2/guide/single-file-components.html#怎么看待关注点分离？)。

React本身不包含对css的处理，只是处理了结构与逻辑的关系，对于css的方案也一直在探索。

- 使用style

```tsx
const Display = (props) => {
	return
		<div style={{
			color: props.color,
			fontSize: '20px'
		}}></div>
}
```

这种使用内联style实现样式的方式对于css几乎没有封装，css完全没法复用，而且内联样式缺乏了许多特性，比如伪选择器，动画/渐变，media query，而且无法使用sass/less/postcss 这类css处理器，这种种限制使得style样式无法胜任复杂的web场景，只能用来做一些简单的样式。

- css module

css  module是利用 css作为一个单元，然后将选择器附加hash，这样可以解决css的冲突问题。

```jsx
// Hello.js
import React from 'react'
import moduleStyle from './hello.module.css'

export default (props) => <h2 className={moduleStyle.red}>{props.children}</h2>

// hello.module.css
.red {
  color: red;
}
```

结果是

```jsx
<Hello>hello world</Hello>

<h2 class="_src_hello_module__red"></h2>
```

css module 利用hash可以解决react中的类名冲突问题，而且还可以配合sass/less/stylus/postcss 等处理器一起使用。

- BEM

由于css类名作用范围是全局，BEM就是一个命名规则，通过合理的class命名来避免样式冲突的问题。

```jsx
import React from 'react'
import './hello.css'

export default (props) => {
  return (
    <div className="hello">
      <p className="hello-title">{props.title}</p>
      <p className="hello-content">{props.children}</p>
    </div>
  )
}
```

这里得到的结果类名就是 hello, hello-title, hello-content 这些。要特别注意的是，并没有要求一定要在组件文件导入css，其实只要在任何一个会被执行到的文件中 `import './hello.js'` 都可以让样式起作用，因为样式是全局的。

BEM的问题在于 命名会显得冗长，需要团队形成共识，避免冲突成为了开发者的心智负担。

- css-in-js

css-in-js 是 是用js 来写样式，能够让css能够利用js的模块化，函数，作用域等语言特性。css-in-js的方案有很多，本文将会针对此方案进行一些介绍。

## css in js

正如前文说到的，css-in-js方案有很多，比如[styled-component](https://github.com/styled-components/styled-components), [emotion](https://github.com/emotion-js/emotion), [jss](https://github.com/cssinjs/jss), [radium](https://github.com/FormidableLabs/radium)。接下来将以styled-component为例，介绍一下 css-in-js的使用，优势，思路

### 使用

```jsx
const Title = styled.h1`
	color: red;
	font-size: 24px;
`

// 使用
<Title>
	content of title
</Title>
```

在内部，会将样式做一个hash，然后传递给标签，这些样式会被插入到cssdom中

```tsx
<h1 class="sc-abc">
	content of title
</h1>

.sc-abc {
	color: red;
	font-size: 24px;
}
```

### 优势

- 独立，规则隔离：样式仅仅作用于当前组件，修改样式不会影响到任何别的地方。styled-component 其实也可以理解为仅仅处理了样式的组件。
- 易于维护：Title组件的样式就在当前文件中，不需要去别的地方找代码，也不用担心改了会影响到其他。css-in-js 使得不需要额外 往html append样式，利于团队合作。而且如果删除一个组件的话，他的样式也会被删除，没有人担忧。
- 利于团队合作：让css经验丰富的写好 styled-components，别人只需要调用就行了，不需要每个人都对css十分了解。
- 性能好：在组件渲染的前，才会将css 插入到style中。在服务端渲染中，由于知道需要渲染哪些组件，所以只会将需要的css插入到style中。在客户端渲染的性能优秀表现在只在渲染组件的时候插入样式，不需要额外的网络请求。
- 动态样式：在做复杂的样式（eg.主题）会非常方便。

### 发展历史

1. [JSS](https://github.com/cssinjs/jss): 第一个css-in-js方案
2. [vjeux@facebook talk](https://blog.vjeux.com/2014/javascript/react-css-in-js-nationjs.html): 介绍了css-in-js在facebook的应用
3. [Radium](https://github.com/cssinjs/jss): 用js的方式写inline style，但是由于inline-style的一些限制，radium需要使用js去实现一些功能，比如监听window的resize事件来实现medium query
4. [Rebass](https://github.com/rebassjs/rebass): 引入了css components api, 比如Box组件，css属性以props形式传递
5. [CSS Modules](https://github.com/css-modules/css-modules)（不是严格意义上的css-in-js）
6. [CSJS](https://github.com/rtsao/csjs): tiny,deprecated。
7. [Aphrodite](https://github.com/Khan/aphrodite): Performance, output atomic class
8. [Fela](https://github.com/robinweser/fela): style is a function of state
9. [Glamor](https://github.com/threepointone/glamor): Performance, 使用CSSOM api insertRule，直接插入css 对象。比直接往style标签里写要快非常多。
10. [jsxstyle](https://github.com/jsxstyle/jsxstyle): Pete hunt, css component like rebass
11. [styled-component](https://github.com/styled-components/styled-components): new api, styled.h1
12. [styleton](https://github.com/styletron/styletron): output atomic class, 优化产出的样式体积
13. [styled-jsx](https://github.com/vercel/styled-jsx): write a style tag in your react component, and they will
14. [astroturf](https://github.com/4Catalyzer/astroturf): first library that allow you to extract to a css file.
15. [glamorous](https://github.com/paypal/glamorous): deprecated
16. [styled-components](https://github.com/styled-components/styled-components) v2: switch to stylus, stylus is tiny and super fast. 现在很多 css-in-js都用stylus作为parser
17. [Emotion](https://github.com/emotion-js/emotion): Perfomance
18. [Linaria](https://github.com/callstack/linaria): 类似与astroturf， api类似与styled-component
19. [Emotion](https://github.com/emotion-js/emotion) v10: style components api ⇒ css api
20. [theme-ui](https://github.com/system-ui/theme-ui)

### 原理

无论是何种css-in-js方案，其大致的原理都是类似的，就是库本身有一个运行时，在运行时会解析用户的样式，在需要时添加前缀，并将其放入到css类中，生成哈希名，利用CSSOM创建或者更新样式。特别要注意的时这种css-in-js的方案 是有运行时成本的。

### 缺点

- css-in-js 没有规范，社区一直在探索，而且有一定的学习成本
- 新的运行时依赖

## css的其他思路

在 [2020年的css报告](https://2020.stateofcss.com/en-US/technologies/css-frameworks/)中，tailwind于2019年一样收到热烈的追捧。tailwind提供了一种 utility class的css方案，提供了很多只有一个属性的类名。

```tsx
<div class="bg-white overflow-hidden ">hello world</div>
<style>
.bg-white {
	--tw-bg-opaciry: 1;
	background-color: rgba(255, 255, 255, var(--tw-bg-opacity));
}
.overflow-hidden {
	overflow: hidden;
}
</style>
```

这种atomic css的思路，使得css可以最大程度的复用，但是也会导致class的名字变长。

使用[twind](https://github.com/tw-in-js/twind)可以将css-in-js与tailwind 结合起来

```js
import { tw } from '<https://cdn.skypack.dev/twind>'

document.body.innerHTML = `
  <main class="${tw`h-screen bg-purple-400 flex items-center justify-center`}">
    <h1 class="${tw`font-bold text(center 5xl white sm:gray-800 md:pink-700)`}">This is Twind!</h1>
  </main>
`
```

结果是

```html
<script type="module" src="<https://cdn.skypack.dev/twind/shim>"></script>

<main class="h-screen bg-purple-400 flex items-center justify-center">
  <h1 class="font-bold text(center 5xl white sm:gray-800 md:pink-700)">This is Twind!</h1>
</main>
```

还可以使用hash 将类名进行hash。

## 参考

- [Max Stoiber-The past, present and future of CSS-in-JS](https://www.youtube.com/watch?v=W-zVPl7CGrY)
- [css-in-js 一个充满争议的技术方案](https://www.infoq.cn/article/95ojp6upti9vsyfsw2xz)
- [Goodbye JavaScript: Introducing our CSS API Client](https://www.algolia.com/blog/product/js-is-dead-all-hail-css/)
- [在react中使用css 的七种方式](https://segmentfault.com/a/1190000018114118)
- [css in 2020](https://2020.stateofcss.com/en-US/technologies/css-in-js/)
- [CSS-in-JS 你所应该知道的一切](https://juejin.cn/post/6844903873962835982#comment)
- [CSS in JS 简介](https://www.ruanyifeng.com/blog/2017/04/css_in_js.html)
