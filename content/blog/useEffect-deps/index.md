---
title: useEffect中如何获取最新的值
date: 2023-07-14 20:44:00
description: 从最简单的场景触发，带你分析如何优化useEffect代码
---

useEffect是React中最常见的hook，但也是最容易用错的一个hook。useEffect 容易用错的原因在于很多地方就算使用方式不对，代码也是能跑起来的，这让很多开发者报有侥幸心理，但是我们仔细一看代码，其实优化空间非常大。本文将从场景出发，逐步分析，如何优化useEffect 代码

假设我们有这样一个场景，有一个计数器 counter， 我们需要在浏览器窗口 resize 的时候打印当前计数器的值

我们会这么写

```jsx
function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handler = () => {
      console.log(count)
    }

    // 绑定事件
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [count])

  return (
    <div className="App">
      <button onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </button>
    </div>
  );
}
```

在useEffect 进行事件绑定，然后将 count 作为依赖传给 useEffect。见 [useEffect-dep - CodeSandbox](https://codesandbox.io/p/sandbox/useeffect-dep-nlfs6z?file=/src/App.tsx:11,1) 。这段代码毫无疑问是可以达到效果的。

其实这也是大部分开发者写的代码，useEffect 使用到了什么变量，就将什么变量放到 useEffect 的依赖列表中。

这样的写法问题在于，每次count 发生变化，useEffect 都要重新执行一下，在这里的场景，就是先removeEventListener，然后再 addEventListener。这里我们只是想在handler 中拿到最新的 count 值，真的有必要重新绑定事件吗？

有同学会说，那把 count 从useEffect 的依赖列表中去除，不就可以了嘛？

显然是不行的，如果count 不在useEffect的依赖列表中的话，因为闭包问题，handler中的count会是第一次绑定事件时候的值，也就是说，不管count 是多少，resize 的时候，打印出来的都是0。

那有没有什么办法能够不重新绑定事件，又能获取到最新的值呢？其实只需要将 count 的值变成一个引用值就可

```js
function App() {
  const [count, setCount] = useState(0);

  const countRef = useRef()
  countRef.current = count

  useEffect(() => {
    const handler = () => {
      console.log(countRef.current)
    }

    console.log('binding event')
    // 绑定事件
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [countRef])

  return (
    <div className="App">
      <button onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </button>
    </div>
  );
}
```

在这里，使用一个ref 将 count 的值进行包裹，每次re-render 的时候，将count 的值赋值给 countRef，在useEffect中的 handler函数直接通过 countRef访问当前的count值，然后将countRef作为依赖传递给useEffect（其实这里传不传都不要紧，因为countRef是一定不会变的，这里传是因为可以规避 eslint的警告）

在 [useEffect-ref - CodeSandbox](https://codesandbox.io/p/sandbox/useeffect-ref-td9mnz?file=/src/App.tsx:14,1) 中可以看到效果，count 变化的时候，不会重新绑定事件，而且 resize 的时候，也能获取到最新的 count 值。

我们一般会把用ref 包裹一个状态变量的这部分封装为一个新的hook

```js
function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

function App() {
  const [count, setCount] = useState(0);

  const countRef = useLatest(count)

  useEffect(() => {
    const handler = () => {
      console.log(countRef.current)
    }

    console.log('binding event')
    // 绑定事件
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [countRef])

  return ...
}
```

见[useEffect-useLatest - CodeSandbox](https://codesandbox.io/p/sandbox/useeffect-uselatest-ryn5y8?file=/src/App.tsx:8,2)

我们再来思考一下，如果我们要抽离一个 useResize 函数，传入一个函数，这个函数将会在窗口 resize 的时候触发。

我们可能会这么写
```js
function useResize(fn: () => void) {
  useEffect(() => {
    console.log('binding event')
    // 绑定事件
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [fn])
}
```

使用的时候

```js
function App() {
  const [count, setCount] = useState(0);

  useResize(() => {
    console.log(count)
  })
}
```
你会发现，这里count变化，导致App组件re-render，传递给 useResize的函数是一个全新的函数，所以在useResize中的useEffect 又会重新执行。这显然是不合理的。

有同学会说，我用 useCallback 将函数封装一下

```js
function App() {
  const [count, setCount] = useState(0);

  const handler = useCalback(() => {
    console.log(count)
  }, [count])

  useResize(handler)
}
```

这样 count 变化的时候，handler 还是会变化，一样是有问题的。

结合前面我们使用 ref 来包裹状态变量的思路，可以这么做

```jsx
function App() {
  const [count, setCount] = useState(0);

  const countRef = useLatest(count)
  const handler = useCallback(() => {
    console.log(countRef.current)
  }, [countRef])

  useResize(handler)

  return ...
}
```
这样 handler 一直都不变，useResize里的useEffect 就不会被重复执行了。

不知道看到这里，各位是不是认为问题解决了呢？其实不然，作为一个公共的hook，现在useResize的实现是不合格的，因为别人要使用useResize，就一定要先保证 函数引用不变，为了保证函数引用不变，又要获取到最新的值，就要使用 useLatest 对状态进行包裹，如果函数中使用了10个状态，就要用10次 useLatest 将状态转为 ref，这简直酸爽。

很多人又说，我直接 `useResie(() => {})` 这样就行了，useEfect 多执行就多执行吧，没要紧。其实在这里多执行几次事件的解绑和绑定并不会有什么实质的影响，但是有的时候，就不一定了，比如 有一个 useChat hook，他的实现是这样

```js
function useChat(fn: () => void) {
  useEffect(() => {
    connect('xxx').then((room) => {
      room.on('message', fn)
    })
    return () => disconnect('xxx')
  }, [fn])
}
```

我们传递一个函数进去，在useEffect中会连接某个房间，然后给房间的message 事件绑定响应函数。

如果这样使用
```js
const [count, setCount] = useState(0);

useChat(() => {
  console.log(count)
})
```
这样，每次 count 变化都会导致房间先断开链接，然后再建立链接。这已经不是性能的问题了，而是业务功能不对了。

那这个应该怎么做呢，我们在回到之前的 `useResize` 的例子。我们换个思路，其实只需要在 `useResize` 中获取到最新的函数就好，我们像之前包装变量一样包装一个函数

```js
function useResize2(fn: () => void) {
  const fnRef = useLatest(fn)
  useEffect(() => {
    const handler = () => {
      fnRef.current?.()
    }
    console.log('binding event')
    // 绑定事件
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [fnRef])
}
```

使用时，非常简单
```js
const [count, setCount] = useState(0);
useResize2(() => {
  console.log('useResize2', count)
})
```

没有任何的心理负担。具体代码 见 [useEffect-useResize - CodeSandbox](https://codesandbox.io/p/sandbox/useeffect-useresize-yj5w8j?file=/src/App.tsx:29,25)

其实，关于useEffect的 使用场景，在React18中，给出了几种分类

- effect: 就是真正需要根据状态变化做出响应，比如 title变量变了，需要 更改`document.title`
- event: 由行为触发，比如说提交表单
- effect event: 在effect中的事件，特点是需要获取最新的值，但是不能额外给useEffect添加新的依赖

而解决方法是
- effect： 真正需要使用 useEffect 的场景
- event：直接使用事件
- effect event: 可以使用 React 新的 useEffectEvent 函数


而在React18以下或者一些自定义hook，则可以考虑使用本文提到的`useLatest`

参考资料：

- [Removing Effect Dependencies – React](https://react.dev/learn/removing-effect-dependencies#do-you-want-to-read-a-value-without-reacting-to-its-changes)
- [一个新的React概念：Effect Event](https://mp.weixin.qq.com/s/wpn1ujDvVp_VBM0_pK1-GA)
- [ahooks](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useLatest/index.ts)