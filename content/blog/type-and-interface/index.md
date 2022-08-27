---
title: typescript中的type和interface
date: 2022-08-27
description: 他们是等价的吗？
---



最近遇到一个问题，使用 interface 和 type 得到了截然不同的结果，代码简化如下

```ts
type Arg = Record<PropertyKey, unknown>

function foo(d: Arg) {
	console.log(d.abc)
}

type PayloadM<T, D> = {
	type: T
	data: D
}

type MyTypeM = PayloadM<'bar', {name: string}>
const m: MyTypeM = {type: 'bar', data: {name: 'xxx'}}
// ok
foo(m)

interface PayloadN<T, D> {
	data: D
	type: T
}

type MyTypeN = PayloadN<'xyz', {name: number}>
const n: MyTypeN = {type: 'xyz', data: {name: 2}}
// error ??
// Argument of type 'MyTypeN' is not assignable to parameter of type 'Arg'.
// Index signature for type 'string' is missing in type 'PayloadN<"xyz", { name: number; // }>'.
foo(n)
```

在上面例子中定义了一个 `foo` 函数，函数有一个参数类型是 `Arg`, `PropertyKey` 是ts内置的类型，`Arg` 的类型定义等价于
```ts
type Arg = {
	[x: string]: unkonwn;
	[x: number]: unknown;
	[x: symbol]: unknown;
}
```

接下来分别使用 type 和 interface 定义了两个泛型类型，`PayloadM`, `PayloadN`, 然后 定义了两个变量 `m`, `n`,分别为 `PayloadM`, `PayloadN`类型，然后将 `m`, `n` 两个变量传递给`foo`函数，`foo(m)` 是没有问题的，但是`foo(n)` 确报错了。

为什么会出现这种错误呢？我们先来看 `foo` 函数的参数`d`其实没有定义有什么属性，所以

```ts
function foo(d: Arg) {
	console.log(d.abc) // ok
	console.log(d.xyz) // ok
}
```

而 `PayloadM` 和 `PayloadN` 都是明确了类型有且只有 `type` 和 `data` 两个属性

```ts
const m: MyTypeM = {type: 'bar'} // error property data is requires in MyTypeM
const m: MyTypeM = {type: 'bar', data: {name: 'xxx'}, other: 'xx'} // error 'other' doesn't exist in MyTypeM
```

```ts
const n: MyTypeN = {type: 'xyz'} // error property data is requires in MyTypeN
const n: MyTypeN = {type: 'xyz', data: {name: 3}, other: 'xx'} // error 'other' doesn't exist in MyTypeN
```

而将 `m`, `n` 传递给 `foo` 的时候，其实是将一个 具体的 类型赋值给一个宽泛的类型。ts 中的 interface 有一个特点就是，不可以将具体的类型赋值给更宽泛的类型(A specific interface cannot be saved into a more generic interface)。而 ts 中的 type 是允许将更具体的类型赋值给更宽泛的类型。

```ts
type MoreGenric = {
	[k: string]: number
}

interface MoreSpecific {
	foo: number
	bar: number
}
let generic: MoreGenric = { abc: 333 }
const specific: MoreSpecific = { foo: 8, bar: 33}
// error Type 'MoreSpecific' is not assignable to type 'MoreGenric'.
// Index signature for type 'string' is missing in type 'MoreSpecific'.
generic = specific
```

```ts
type MoreGenric = {
	[k: string]: number
}

type MoreSpecific = {
	foo: number
	bar: number
}

let generic: MoreGenric = { abc: 333 }
const specific: MoreSpecific = { foo: 8, bar: 33}
generic = specific // ok
```

通过 type 类型，可以将更具体类型赋值给更宽泛的类型，上面的例子中 `MoreGeneric`使用type 定义的，用 interface 定义也是一样的结果。

我们再次回到最开始的场景，也就是说，可以用 type 不要 interface 来让代码不报错。那如果硬是要使用interface 类型呢（有时候变量类型不是开发能够修改的），可以使用扩展运算符

```ts
type MyTypeN = PayloadN<'xyz', {name: number}>
const n: MyTypeN = {type: 'xyz', data: {name: 2}}
foo({...n})
```

通过使用扩展运算符，可以强制让 ts 将 `{...n}` 识别为可以索引的。这种方式有些 hack。可以看[issue](https://github.com/microsoft/TypeScript/issues/15300)。

根据报错，我们还可以通过让 `PayloadN` 通过 interface extends  的方式让其变得可索引
```ts
type Arg = Record<PropertyKey, unknown>
interface PayloadN<T, D> extends Arg {
	data: D
	type: T
}

type MyTypeN = PayloadN<'xyz', {name: number}>
const n: MyTypeN = {type: 'xyz', data: {name: 33}}

foo(n) // ok
```

参考

- [How to fix "Index signature is missing in type" error?](https://stackoverflow.com/questions/60697214/how-to-fix-index-signature-is-missing-in-type-error)
- [Index signature for type 'string' is missing in type](https://stackoverflow.com/questions/73372799/index-signature-for-type-string-is-missing-in-type)

