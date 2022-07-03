---
title: css-in-js-under-the-hood
date: 2021-07-12 23:31:58
description: css-in-js 底层到底是如何工作的呢？
---

css-in-js是一个 css方案，在react中使用者非常多。喜欢他的人对其称赞不已，讨厌他的人对其嗤之以鼻。关于css-in-js这个技术方案的历史发展和优缺点在[前文](https://colgin.github.io/2021/01/25/css-in-js/) 已经有分析，本文不做过多讲解，本文将以styled-components探讨一下css-in-js 实现的原理。<!--more-->

## 用法

在[style-components官网](https://styled-components.com/) 可以看到用法

```jsx
const Button = styled.a`
  /* This renders the buttons above... Edit me! */
  display: inline-block;
  border-radius: 3px;
  padding: 0.5rem 0;
  margin: 0.5rem 1rem;
  width: 11rem;
  background: transparent;
  color: white;
  border: 2px solid white;

  /* The GitHub button is a primary button
   * edit this to target it specifically! */
  ${props => props.primary && css`
    background: white;
    color: black;
  `}
`

render(
  <div>
    <Button
      href="https://github.com/styled-components/styled-components"
      target="_blank"
      rel="noopener"
      primary
    >
      GitHub
    </Button>

    <Button as={Link} href="/docs">
      Documentation
    </Button>
  </div>
)
```

可以看到，通过调用 `styled.a`返回的就是一个组件。后面的参数是用 `` 符号包裹的。这是 [tagged templates]([Tagged templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates))。其实就相当于函数调用。

## 基础

### 将函数参数解析为style字符串

通过MDN实例，可以看出，函数的第一个参数是一个数组，是整个参数被`${}` 分割的字符串。因此可以将函数这样定义。

```javascript
function evaluate(str, ...expressions) {
  return expressions.reduce((acc, exp, index) => {
    acc += `${exp}${str[index + 1]}`;
    return acc;
  }, `${str[0]}`);
}
```



我们来试验一下

```javascript
evaluate`Good ${ Math.random() > 0.5 ? 'afternoon' : 'morning'}` // 随机返回 'Good morning'或者'Good afternoon'
```

上面这个例子中，evaluate 可以接受动态js 语句。在 style-component中 表达式 也可以是一个一个函数，函数是参数从哪里来呢？其实要知道 style-component返回的是一个组件，在React中，一个接收props返回 vdom的 函数就可以是一个组件。因此，我们将上面的evaluate函数进行一些改写



```js
function evaluate(str, ...expressions) {
  return props => {
    return expressions.reduce((acc, exp, index) => {
      acc += `${evaluateExp(exp, props)}${str[index + 1]}`;
      return acc;
    }, `${str[0]}`);
  };
}

function evaluateExp(exp, props) {
  if (typeof exp === 'function') {
    return exp(props);
  }
  return exp;
}
```



### 返回一个组件

在这个实现中，返回值是一个函数，但是这个函数只是返回了一个拼接字符串，并没有渲染任何内容。

让我们再次回到styled-component的使用例子，我们一般都是 

```js
const RedLink = styled.a`
	color: red
`
```

渲染的实际内容是一个 红色的 a标签， 因此我们可以对上文的函数进行改写

```js
import { createElement } from 'react'

const styled = (target) => (strs, ...expressions) => (props) => {
   const cssText = expressions.reduce((acc, exp, index) => {
      acc += `${evaluateExp(exp, props)}${str[index + 1]}`;
      return acc;
    }, `${str[0]}`);
  };

	return createElement(target, {
    style:  cssText
  })
}

function evaluateExp(exp, props) {
  if (typeof exp === 'function') {
    return exp(props);
  }
  return exp;
}

const allElements = [
  'a',
  'h1',
  'h2',
  'p',
  'div',
  // ...
]

allElements.forEach(ele => {
  styled[ele] = styled(ele)
})
```



到这里为止，我们已经实现了了一个最简陋，最基础的styled-component实现了。接下来我们要对一些细节进行处理



## 补充一些细节

###  使用 css dom替换行内css

上面的代码中，我们将生成的style以行内style的形式注入。这种方式不利于样式的复用。我们可以考虑根据这些css 生成一个 className，然后将这一条规则插入到style标签中。

如何根据css生成一个className呢？我们希望相同的css可以生成一样的hash，这样就可以复用了了。可以使用[MurmurHash](https://www.wikiwand.com/en/MurmurHash)来实现，他是一个高效的hash算法，同样的输入，必定有同样的输出，很符合我们的要求。但是....等等，cssText是由用户输入的，我们只做了拼接。cssText 是由一条一条规则组成的，有时候用户输入的不一样，但是其实是一样的，比如

```javascript
styled.a`
	color: red;
	font-size: 24;
`

styled.a`
	
`
```



...未完待续
