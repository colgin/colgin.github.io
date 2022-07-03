---
title: 封装Promise，让他更好用一些
date: 2021-05-15 15:51:35
description: 最简单的api也能封装！
---

看到标题，很多人要说了，`Promise` 不就原生支持的 `Promise` 嘛，还有啥好封装的？或者说你要封装`Promise`还不如直接使用 async , await 不就行了。如果你是这么想的，那么请继续阅读下去。 <!-- more -->

笔者最近在设计 API 的时候，遇到这么一个很常见的场景。需要通过传入一个外部函数来控制代码的执行流程，比如在文件 上传之前，调用传入的函数来检查文件是否符合要求，只有符合要求的情况才会上传，否则就会中断。这个函数可能是异步的，也可能是是同步的，只有当结果是 `Promise.reolve(true)`或者 `true`的时候，才算符合要求。不符合要求的时候要提示一下，而且文件上传错误的时候也要提示。

如果使用 Promise，实现代码可能如下

```typescript
type BeforeUpload = (f: File) => Promise<boolean> | boolean

const before: BeforeUpload = function upload(file: File) { // 用户传入的函数
  const beforeResult = before(file)
  const beforePromise =
    typeof beforeResult === 'boolean'
      ? Promise.resolve(beforeResult)
      : beforeResult

  beforePromise
    .then((res) => {
      // true
      if (res) {
        await uploadFile(file)
      } else {
        toaster.warning('文件不符合要求')
      }
    })
    .catch((err) => {
      // beforePromise如果直接是 reject的话，这里不好区分 upload报错还是 beforePromise校验报错。
    })
}
```

可以看到由于函数执行的结果类型不一样，需要将函数执行的结果转换为 `Promise`，这里会有一点啰嗦。

而且，我们需要将 校验报错和上传报错区分开，上面的写法就不是很好了。可以在上面的基础上进行一些小修改，代码如下

```typescript
function upload(file: File) {
  const beforeResult = before(file)
  const beforePromise =
    typeof beforeResult === 'boolean'
      ? Promise.resolve(beforeResult)
      : beforeResult

  beforePromise
    .then(
      (res) => {
        if (res) {
          await uploadFile(file)
        } else {
          toaster.warning('文件不符合要求')
        }
      },
      (err) => {
        toaster.warning('文件不符合要求')
      }
    )
    .catch((err) => {
      toaster.warning('上传出错')
    })
}
```

是可以达到目的，但是代码就很割裂，文件不符合要求的提示重复出现（当然这个和前面提到的需求相关，不过不妨碍，请继续阅读）

接下来我们使用 async, await 来处理，由于校验和上传二者个错误需要分开处理，这里需要两个 try..catch

```typescript
async function upload(file: File) {
  try {
    const beforeResult = await before(file)
    if (!beforeResult) {
      throw new Error()
    }
  } catch (err) {
    toaster.warning('文件不符合要求')
    return
  }

  try {
    await uploadFile(file)
  } catch (err) {
    toaster.warning('文件上传出错')
  }
}
```

async, await 能够处理这种情况，但是由于需要处理两种不同类型的报错，我们需要写两个 try ... catch 来辨别不同的错误（这里不知有没有更优的方案），其实这里还可以将上传错误定一一个新的错误类型，使用一个 try...catch，在 catch 中根绝 Error 类型就知道是什么原因的报错，但是这里也不太好做。

async, await + try ... catch 再带来优秀的代码书写体验的同时，也让代码变得非常不好看，try ... catch 让代码都往里缩进了。而且 async, await 目前还是要借助 babel/regenerator 来兼容不支持 此特性的浏览器，这是有额外的运行时成本。这也是笔者不那么喜欢 async, await 的原因。当然不得不承认 async，await 处理异步逻辑确实比 `Promise`直观。

那有没有什么方法能够将二者的特性兼而有之呢？在笔者的探索过程中，go 语言的错误处理让笔者眼前一亮。

```go
i, err := strconv.ParseInt("123", 10, 32)
if err != nil {
  panic(err)
}
```

这种出现错误，就要求及时处理的 api 设计不就能够符合我们的需求吗？

我们需要一个 promiseWrapper 来对一个 promise 对象进行包装，让它的结果和错误以 tuple 的形式返回。

```typescript
function promiseWrapper(p: Promise<any>) {
  return p.then((data) => [data, null]).catch((err) => [null, err])
}
```

这里最简单的一种形式，当然我们希望这个函数不仅仅可以接受 Promise 对象，还可接受普通对象, 只需要稍加修改

```typescript
type MaybePromise<T> = Promise<T> | T
function isPromise(value: any): value is Promise {
  return Object.prototype.toString.call(value) === '[object Promise]'
}
function promiseWrapper<T>(p: MaybePromise<T>) {
  return (isPromise(p) ? p : Promise.resolve(p))
    .then((data) => [data, null])
    .catch((err) => [null, err])
}
```

再回到之前的问题，再用 promisewrapper 来实现一下

```typescript
async function upload(file: File) {
  const [beforeResult, beforeErr] = await promiseWrapper((before(file))
  if (!beforeResult || beforeErr) {
    toaster.warning('文件不符合要求')
    return
  }
  const [_, uploadErr] = await promiseWrapper(uploadFile(file))
  if (uploadErr) {
    toaster.warning('文件上传出错')
  }
}
```

代码是不是简洁干净了很多呢？

如果有多个异步过程并行怎么办？先使用 Promise.all 返回一个 promise 然后丢给 promiseWrapper

```typescript
const files = [file1, file2, file3]

async function upload(file: File) {
  const [beforeResult, beforeErr] = await promiseWrapper(Promise.all(files.map(before)))
  if (!beforeResult.every(Boolean) || beforeErr)
    toaster.warning('文件不符合要求')
    return
  }
  const [_, uploadErr] = await promiseWrapper(Promise.all(files.map(uploadFile)))
  if (uploadErr) {
    toaster.warning('文件上传出错')
  }
}
```

注意：上面代码表示所有的文件校验成功才会继续上传，只是为了举例，并不一定符合生产要求。

## 结论

可以看到，通过我们封装的 promiseWrapper 函数，在处理异步的时候相对于 原生 try...catch 来说，还是提供了一个新的思路，至于编码风格，就萝卜青菜，各有所爱了。
