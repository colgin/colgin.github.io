---
title: type-challenges
date: 2021-05-28 01:03:19
description: 类型体操64式
---

typescript的类型运算能够让我们在写代码时设计出更加完善，健壮的类型。这方面的教程不多，官网文档例子也有限，正好看到 社区中有一个 项目[type-challenges](https://github.com/type-challenges/type-challenges) ，可以帮助我们学习ts的类型，本文就算是记录针对该教程的一个学习过程吧。<!-- more -->


### 实现Pick

[原题](https://github.com/type-challenges/type-challenges/blob/master/questions/4-easy-pick/README.zh-CN.md)

```typescript
interface Todo {
  title: string
  description: string
  completed: boolean
}

type TodoPreview = MyPick<Todo, 'title' | 'completed'>

const todo: TodoPreview = {
    title: 'Clean room',
    completed: false,
}
```

答案

```typescript
// solution
type MyPick<T, K extends keyof T> = {
    [P in K]: T[P]
}

```



## Tuple to Object

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/11-easy-tuple-to-object/README.md)

```typescript
const tuple = ['tesla', 'model 3', 'model X', 'model Y'] as const

const result: TupleToObject<typeof tuple> // expected { tesla: 'tesla', 'model 3': 'model 3', 'model X': 'model X', 'model Y': 'model Y'}
```

答案

```typescript
type TupleToObject<T extends readonly any[]> = {
    [P in T[number]]: P
}
```

这里要注意几个点。

1. 只有 `as const`修饰的数组才能获得值类型，否则，tuple的类型就是 `string[]`了
2. `extends` 后面可以加 readonly来修饰
3. 要记住 in 后面只能是一个 联合类型，P就是单个的类型



### First Of Array

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/14-easy-first/README.md)

```typescript
type arr1 = ['a', 'b', 'c']
type arr2 = [3, 2, 1]

type head1 = First<arr1> // expected to be 'a'
type head2 = First<arr2> // expected to be 3
```

答案

```typescript
type First<T extends any[]> = T[0]
```



也可以使用infer来实现

```typescript
type First<T extends any[]> = T[0] extends infer U ? U : never
```

上面这两种解法，如果是一个空数组，则返回 `undefined`, 这一点题目里没有描述清楚，有时候或许也需要返回 `never`

```typescript
type First<T extends any[]> = T['length'] extends 0 ? never : T[0]
```



### Length of Tuple

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/18-easy-tuple-length/README.md)

```typescript
type tesla = ['tesla', 'model 3', 'model X', 'model Y']
type spaceX = ['FALCON 9', 'FALCON HEAVY', 'DRAGON', 'STARSHIP', 'HUMAN SPACEFLIGHT']

type teslaLength = Length<tesla>  // expected 4
type spaceXLength = Length<spaceX> // expected 5
```

答案

```typescript
type Length<T extends any[]> = T['length']
```

如果不在泛型上约束为数组的话，需要在结果处进行约束

```typescript
type Length<T> = 'length' extends keyof T ? T['lenght'] : never
```



### Exclude

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/43-easy-exclude/README.md)

先看下Exclude的[功能](https://www.typescriptlang.org/docs/handbook/utility-types.html#excludetype-excludedunion)

```typescript
type T0 = Exclude<"a" | "b" | "c", "a">;
     
type T0 = "b" | "c"
type T1 = Exclude<"a" | "b" | "c", "a" | "b">;
     
type T1 = "c"
type T2 = Exclude<string | number | (() => void), Function>;
```



```typescript
type MyExclude<T, U> = T extends U ? never : T
```

**extends这里的这个用法要留意下**



### Awaited

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/189-easy-awaited/README.md)

If we have a type which is wrapped type like Promise. How we can get a type which is inside the wrapped type? For example if we have `Promise<ExampleType>` how to get ExampleType?

答案

```typescript
type AwaitedType<T> = T extends Promise<infer U> ? U : never
```



### If

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/268-easy-if/README.md)

```typescript
type A = If<true, 'a', 'b'>  // expected to be 'a'
type B = If<false, 'a', 'b'> // expected to be 'b'
```

答案

```typescript
type If<V extends boolean, T, F> = V extends true ? T : F
```

这里要知道的是值类型，为true的时候，应该`v extends true` 这样写



### Concat

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/533-easy-concat/README.md)

```typescript
type Result = Concat<[1], [2]> // expected to be [1, 2]
```

答案

```typescript
ype Concat<U extends any[], T extends any[]> = [...U, ...T]
```

**这里`...`这个用法要学习一下**

```typescript
type Q = [number, string]

function foo(...args: [...Q]) {

}

foo(2, 'hello')
```



### Includes

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/898-easy-includes/README.md)

```typescript
type isPillarMen = Includes<['Kars', 'Esidisi', 'Wamuu', 'Santana'], 'Dio'> // expected to be `false`

```

答案

```typescript
type Includes<T, U> = U extends T ? true : false
```



### ReturnType

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/2-medium-return-type/README.md)

```typescript
const fn = (v: boolean) => {
  if (v)
    return 1
  else
    return 2
}

type a = MyReturnType<typeof fn> // should be "1 | 2"
```

答案

```typescript
type MyReturnType<F extends Function> = F extends (...args: any[]) => infer R ? R : never
```



### 实现Omit

[原题](https://github.com/type-challenges/type-challenges/blob/master/questions/3-medium-omit/README.zh-CN.md)

```typescript
interface Todo {
  title: string
  description: string
  completed: boolean
}

type TodoPreview = MyOmit<Todo, 'description' | 'title'>

const todo: TodoPreview = {
  completed: false,
}
```

答案

可以使用ts内置的Exclude工具

```typescript
type MyOmit<T, K extends keyof T> = {
    [P in Exclude<keyof T, K>]: T[P]
}
```



另外，typescript4.1 提供了一个新能力[Key Remapping in Mapped Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#key-remapping-in-mapped-types)。根据文档

> lots of the time you want to be able to create new keys, or filter out keys, based on the inputs

Filter out keys by producing never.

因此这题还可以这样写

```typescript
type MyOmit<T, K extends keyof T> = {
    [P in keyof T as P extends K ? never : P]: T[P]
}
```

在issue里还看到了这种[解法](https://github.com/type-challenges/type-challenges/issues/1461)

```typescript
type MyOmit<T extends object, K extends keyof T> = {
    [P in keyof T extends infer R
        ? R extends keyof T
        ? R extends K
            ? never
            : R
        : never
    : never
    ]: T[P]
}

```

在ts类型运算中，不能用 && ，只能用三元.

### Readonly

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/8-medium-readonly-2/README.md)

```typescript
interface Todo {
  title: string
  description: string
}

const todo: MyReadonly<Todo> = {
  title: "Hey",
  description: "foobar"
}

todo.title = "Hello" // Error: cannot reassign a readonly property
todo.description = "barFoo" // Error: cannot reassign a readonly property
```

答案

```typescript
type MyReadonly<T extends object> = {
    readonly [P in keyof T]: T[P]
}
```



### DeepReadonly

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/9-medium-deep-readonly/README.md)

```typescript
type X = { 
  x: { 
    a: 1
    b: 'hi'
  }
  y: 'hey'
}

type Expected = { 
  readonly x: { 
    readonly a: 1
    readonly b: 'hi'
  }
  readonly y: 'hey' 
}

const todo: DeepReadonly<X> // should be same as `Expected`
```

答案

```typescript
type DeepReadonly<T extends object> = {
  readonly[P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}
```

如果要考虑，更多类型的话，比如函数

```typescript
type DeepReadonly<T> = 
	T extends Function
  ? T 
    : T extends object 
      ? { readonly [P in keyof T]
      : DeepReadonly<T[P]> }
  : T
```



### Tuple to Union

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/10-medium-tuple-to-union/README.md)

```
type Arr = ['1', '2', '3']

const a: TupleToUnion<Arr> // expected to be '1' | '2' | '3'
```

答案

```typescript
type TupleToUnion<T extends any[]> = T[number]
```



### Chainable Options

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/12-medium-chainable-options/README.md)

链式调用的类型

```typescript
declare const config: Chainable

const result = config
  .option('foo', 123)
  .option('name', 'type-challenges')
  .option('bar', { value: 'Hello World' })
  .get()

// expect the type of result to be:
interface Result {
  foo: number
  name: string
  bar: {
    value: string
  }
}
```

答案

```typescript
interface Chainable<T> {
  option: <Key extends string, Value>(key: Key, value: Value) => Chainable<T & { [K in Key]: Value} >
  get: () => T
}
```

结果要记住参数的类型，只有使用泛型。

这里要知道的一个点是，option函数的第一个参数要作为值类型，这种应该使用泛型类型才能获取到值类型。

```typescript
function foo<K extends string, V>(key: K, value: V): [K, V] {
  return [key, value] // good
  // return [key + 'hello', value] // type error 
}
```



### Last of Array

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/15-medium-last/README.md)

```typescript
type arr1 = ['a', 'b', 'c']
type arr2 = [3, 2, 1]

type tail1 = Last<arr1> // expected to be 'c'
type tail2 = Last<arr2> // expected to be 1
```

答案

```typescript
type Last<T extends any[]> = T extends [...any, infer U] ? U : never
```

这里不能像之前那个求第一个元素那样了，因为最后一个是需要运算的，而类型是不支持值运算的

```typescript
// wrong
type Last<T extends any[]> = T['length'] extends 0 ? never : T[T['length'] - 1]
```



### Pop

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/16-medium-pop/README.md)

```typescript
type arr1 = ['a', 'b', 'c', 'd']
type arr2 = [3, 2, 1]

type re1 = Pop<arr1> // expected to be ['a', 'b', 'c']
type re2 = Pop<arr2> // expected to be [3, 2]
```

答案

```typescript
type Pop<T extends any[]> = T extends [...infer U, infer _] ? U : never
```

还可以使用Shift, Push, Unshift

```typescript
type Shift<T extends any[]> = T extends[infer U, ...infer R] ? R : never

type Push<T extends any[], V> = [...T, V]

type Unshift<T extends any[], V> = [V, ...T]
```

都很简单，这里要注意的就是要牢记，值类型。还有类型的 ```...``` 运算

### Promise.all

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/20-medium-promise-all/README.md)

```typescript
const promise1 = Promise.resolve(3);
const promise2 = 42;
const promise3 = new Promise<string>((resolve, reject) => {
  setTimeout(resolve, 100, 'foo');
});

// expected to be `Promise<[number, number, string]>`
const p = Promise.all([promise1, promise2, promise3] as const)
```



答案

```typescript
declare function PromiseAll<T extends any[]>(value: readonly[...T]): Promise<{
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K]
}>
```

这里的知识点是[Variadic Tuple Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html#variadic-tuple-types)，Array 或者 Tuple 可以使用扩展运算符。



### Type Lookup

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/62-medium-type-lookup/README.md)

```typescript
interface Cat {
  type: 'cat'
  breeds: 'Abyssinian' | 'Shorthair' | 'Curl' | 'Bengal'
}

interface Dog {
  type: 'dog'
  breeds: 'Hound' | 'Brittany' | 'Bulldog' | 'Boxer'
  color: 'brown' | 'white' | 'black'
}

type MyDogType = LookUp<Cat | Dog, 'dog'> // expected to be `Dog`
```

答案

```typescript
type LookUp<U, T> = U extends {type: T} ? U : never;
```

这里要多理解一下



### Trim Left

[题目]()

```typescript
type trimed = TrimLeft<'  Hello World  '> // expected to be 'Hello World  '
```

答案

```typescript
type TrimLeft<T extends string> = T extends `${' '}${infer R}` ? TrimLeft<R> : T
```

这里就是利用ts的[template string type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-3.html)

可以参考这个例子

```typescript
declare function foo<V extends string>(arg: `*${V}*`): V;
function test<T extends string>(s: string, n: number, b: boolean, t: T) {
    let x1 = foo("*hello*");            // "hello"
    let x2 = foo("**hello**");          // "*hello*"
    let x3 = foo(`*${s}*` as const);    // string
    let x4 = foo(`*${n}*` as const);    // `${number}`
    let x5 = foo(`*${b}*` as const);    // "true" | "false"
    let x6 = foo(`*${t}*` as const);    // `${T}`
    let x7 = foo(`**${s}**` as const);  // `*${string}*`
}
```



### Trim

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/108-medium-trim/README.md)

```typescript
type trimed = Trim<'  Hello World  '> // expected to be 'Hello World'
```

答案

```typescript
type Trim<T extends string> =
  T extends `${' '}${infer R}`
  ? Trim<R>
  : T extends `${infer U}${' '}`
    ? Trim<U>
    : T
```

这里用到 这个 extends后面的 空字符类型要用`${ }` ，不能直接用`' '`,  是因为这里是作为值类型？



### Capitalize

[题目]()

```typescript
type capitalized = Capitalized<'hello world'> // expected to be 'Hello world'
```

答案

```typescript
type Capitalized<T extends string> = T extends `${infer U}${infer R}` ? `${Uppercase<U>}${R}` : never
```

这里要注意的是 这里将字母大写，类型的运算，可以直接借助`Uppercase<>`进行泛型运算。

这里，我就很好奇，这种 `Uppercase` 这种和值类型相关的转换的泛型的实现是怎么实现的。一看好家伙

```typescript
/**
 * Convert string literal type to uppercase
 */
type Uppercase<S extends string> = intrinsic;

/**
 * Convert string literal type to lowercase
 */
type Lowercase<S extends string> = intrinsic;

/**
 * Convert first character of string literal type to uppercase
 */
type Capitalize<S extends string> = intrinsic;

/**
 * Convert first character of string literal type to lowercase
 */
type Uncapitalize<S extends string> = intrinsic;
```

貌似都不是通过正常手段算出来的，是编译器内部提供了实现逻辑。参考 [pr](https://github.com/microsoft/TypeScript/pull/40580)。原文中有这么一段话

> Note that the `Capitalize<S>` and `Uncapitalize<S>` intrinsic types could fairly easily be implemented in pure TypeScript using conditional types and template literal type inference, but it isn't practical to do so at the moment because we use ESLint which hasn't yet been updated to support template literal types (though we expect that to happen soon).

目前不使用纯typescript 条件运算的原因竟然是因为eslint不支持 template literal types. 然后我就在想这个应该怎么实现呢？

[How to UPPER_CASE to camelCase in raw Typescript generics](https://dev.to/svehla/typescript-transform-case-strings-450b)提供了一些思路。大致就是利用 一个map

```typescript
type LetterMap = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  e: 'E'
  // ...
  h: 'H'
}

// 将首字母大写
type Upper<S extends string> = S extends `${infer S}${infer R}`
  ? S extends keyof LetterMap
    ? `${LetterMap[S]}${R}`
    :  `${S}${R}`
  : S

type Q = Upper<'hello'> // Q is expected as 'Hello'
```

emm，很妙🐱

### Replace

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/116-medium-replace/README.md)

```typescript
type replaced = Replace<'types are fun!', 'fun', 'awesome'> // expected to be 'types are awesome!'

```

答案

```typescript
type Replace<S extends string, FROM extends string, TO extends string> = S extends `${infer BEGIN}${FROM}${infer END}`
  ? `${BEGIN}${TO}${END}`
  : S
```

一遍就写过了，没什么好说的，理解思路吧。



### ReplaceAll

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/119-medium-replaceall/README.md)

```typescript
type replaced = ReplaceAll<'t y p e s', ' ', ''> // expected to be 'types'
```

答案

```typescript
type ReplaceAll<S extends string, FROM extends string, TO extends string> = S extends `${infer BEGIN}${FROM}${infer END}`
  ? `${BEGIN}${TO}${ReplaceAll<END, FROM, TO>}`
  : S
```

和上面这个Replace的区别在于，递归处理。



### Append Argument

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/191-medium-append-argument/README.md)

```typescript
type Fn = (a: number, b: string) => number

type Result = AppendArgument<Fn, boolean> 
// expected be (a: number, b: string, x: boolean) => number

```

答案

```typescript
type AppendArgument<Fn extends Function, A> = Fn extends (...args: infer U) => infer R ? (...args: [...U, A]) => R : never
```

也可以直接用Parameters, ReturnType

```typescript
type AppendArgument<Fn extends (...args: any) => any, A> = (...args: [...Parameters<Fn>, A]) => ReturnType<Fn>
```

这里不能这样写

```typescript
type AppendArgument<Fn extends Function, A> = (...args: [...Parameters<Fn>, A]) => ReturnType<Fn>
```

会报错，Function doesn't satisfy (...args: any) => any, 

```typescript
type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;
```

Function类型不能复制给这俩。可以看这个 [issue](https://github.com/microsoft/TypeScript/issues/34540)

原因是ts没有运行时，Function并不一定能执行。

```typescript
const f = Object.create(Function);
f instanceof Function; // true
f(); // crashes
```



### Permutation

[题目]()

```typescript
type perm = Permutation<'A' | 'B' | 'C'>; // ['A', 'B', 'C'] | ['A', 'C', 'B'] | ['B', 'A', 'C'] | ['B', 'C', 'A'] | ['C', 'A', 'B'] | ['C', 'B', 'A']

```

答案

```typescript
type Permutation<S extends string, T extends any[] = []> = [S] extends [never]
  ? []
  : {
      [K in S]: Exclude<S, K> extends never
        ? [K, ...T]
        : Permutation<Exclude<S, K>, [K, ...T]>
    }[S]
```

这个有点难，要多理解一下



### Length of String

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/298-medium-length-of-string/README.md)

答案

```typescript
type LengthOfString<S extends string, T extends string[] = []>
= S extends `${string}${infer R}`
  ? LengthOfString<R, [...T, string]>
  : T['length'];
```

没写出来，这个实现太秀了。将字符串递归转化为元组，使用递归泛型存储变量。



### Flatten

[题目]()

```typescript
type flatten = Flatten<[1, 2, [3, 4], [[[5]]]>
 // [1, 2, 3, 4, 5]
```

答案

```typescript
type Flatten<K extends any[]> = K extends [infer First, ...infer Rest]
  ? First extends any[]
    ? [...Flatten<First>, ...Flatten<Rest>]
    : [First, ...Flatten<Rest>]
  : K
```

也可以利用泛型变量的递归

```typescript
type Flatten<K extends any, T extends any[] = []> = K extends [infer First, ...infer Rest]
  ? First extends any[]
    ? Flatten<[...First, ...Rest], T>
    : Flatten<Rest, [...T, First]>
  : T
```

将结果存到泛型变量上时，只有在符合要求的时候才会往泛型上存。最后将泛型返回。

### Append to object

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/527-medium-append-to-object/README.md)

```typescript
type Test = { id: '1' }
type Result = AppendToObject<Test, 'value', 4> // expected to be { id: '1', value: 4 }

```

答案

```typescript
type AppendToObject<T extends Record<string, any>, K extends string, V> = {
  [P in keyof T | K]: P extends K ? V : T[P]
}
```

注意这里，这里不能

```typescript
type AppendToObject<T extends Record<string, any>, K extends string, V extends any> = {
  [P in keyof T]: T[P],
  [K]: V
}
```



### Absolute

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/529-medium-absolute/README.md)

```typescript
type Test = -100;
type Result = Absolute<Test>; // expected to be "100"
```

```typescript
type Absolute<T extends number | string | bigint> =
`${T}` extends `-${infer R}`
  ? `${R}`
  : `${T}`
```

可以利用模板字符串, 只有模板字符串有 值类型 模板。



### String to Union

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/531-medium-string-to-union/README.md)

```typescript
type Test = '123';
type Result = StringToUnion<Test>; // expected to be "1" | "2" | "3"
```

答案

```typescript
type StringToUnion<T extends string> = T extends `${infer First}${infer Rest}`
  ? First | StringToUnion<Rest>
  : never
```

可使用递归泛型

```typescript
type StringToUnion<T extends string, R = never> = T extends `${infer First}${infer Rest}`
  ? StringToUnion<Rest, R | First>
  : R
```

和前面那道 Flatten是一样的思路.



### Merge

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/599-medium-merge/README.md)

Merge two types into a new type. Keys of the second type overrides keys of the first type.

```typescript
type T1 = {
  name: string
  age: number
}

type T2 = {
  name: string
  age: string
  addr: string
}
type Q = Merged<T1, T2> // expected { name: string, age: string, addr: string }
```

答案

```typescript
type Merged<T, K> = {
  [P in keyof T | keyof K]: P extends keyof K ? K[P] : P extends keyof T ? T[P] : never
}
```



### CamelCase

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/610-medium-camelcase/README.md)

`for-bar-baz` -> `forBarBaz`

```typescript
type CamelCaseFirst<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : S
type CamelCased<S extends string> = S extends `${infer First}-${infer Rest}`
  ? `${First}${CamelCased<CamelCaseFirst<Rest>>}`
  : S extends `${infer First}${infer Rest}`
    ? `${First}${CamelCased<Rest>}`
    : S
```



这个也比较简单, 这里我们手写了一个 `CamelCaseFirst`, 其实可以用`Capitalize`替代

### KebabCase

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/612-medium-kebabcase/README.md)

`FooBarBaz` -> `for-bar-baz`

答案

```typescript
type KebabCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? Rest extends `${infer F}${infer R}`
    ? F extends Capitalize<F>
      ? `${Lowercase<First>}-${Lowercase<F>}${KebabCase<R>}`
      : `${Lowercase<First>}${KebabCase<Rest>}`
    : `${Lowercase<First>}${KebabCase<Rest>}`
  : S
```

或者

```typescript
type KebabCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? Rest extends Uncapitalize<Rest>
    ? `${Lowercase<First>}${KebabCase<Rest>}`
    : `${Lowercase<First>}-${KebabCase<Uncapitalize<Rest>>}`
  : Uncapitalize<S>
```



前一个是一位 `Capitalize` 只能处理一个字符。所以多了一个 三元表达式用来获取第一个字符。其实 `Capitalize` 可以接收一个字符串。所以有了第二个答案。

第二个答案条件是 `extends Uncapitalize<Rest>` ，条件不符合才加`-`, 这里不能反过来写，因为 Rest = `''`的话，可以满足 `Uncapitalize` 和`Capitalize` ，但是是不需要加 `-`的。如果换一下顺序会导致多一个 `-`

```typescript

type S = KebabCase<'ForBarBaz'> // for-bar-baz-


type KebabCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? Rest extends Capitalize<Rest>
    ? `${Lowercase<First>}-${KebabCase<Uncapitalize<Rest>>}`
    : `${Lowercase<First>}${KebabCase<Rest>}`
  : Uncapitalize<S>
```



### AnyOf

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/949-medium-anyof/README.md)

```typescript
type Sample1 = AnyOf<[1, "", false, [], {}]>; // expected to be true.
type Sample2 = AnyOf<[0, "", false, [], {}]>; // expected to be false.
```



答案

```typescript
type AnyOf<T extends any[]> = T extends [infer First, ...infer Rest]
  ? First extends ([] | Record<string, any> | 0 | false | '')
    ? AnyOf<Rest>
    : true
  : false
```

这里千万要注意描述对象要用 `Record<string, any>`,或者 `{[key: string]: any }` 不能用 `{}`  ,这里应该是容易被误判断为空interface

```typescript
type S = 1 extends {} ? true : false // true
```

也可以使用索引

```typescript
type AnyOf<T extends any[]> = T[number] extends [] | { [k: string ]: any} | 0 | false | '' ? false : true
```



### IsNever

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/1042-medium-isnever/README.md)

```typescript
type A = IsNever<never>  // expected to be true
type B = IsNever<undefined> // expected to be false
type C = IsNever<null> // expected to be false
type D = IsNever<[]> // expected to be false
type E = IsNever<number> // expected to be false
```

答案

这题，我一开始是这么写的

```typescript
type IsNever<T> = T extends never ? true : false
```

发现 `IsNever<never>`一直都是`never` 。然而 下面

```typescript
type S = never extends never ? true : false 
```

S就是 true，难道是泛型参数不能传 never？？

后面看了一下别人的解答，发现，都是 不直接 用never来判断

```typescript
type IsNever<T> = T | true extends true ? true : false
type IsNever<T> = [T] extends [never] ? true : false
```



## IsUnion

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/1097-medium-isunion/README.md)

```typescript
type case1 = IsUnion<string>  // false
type case2 = IsUnion<string|number>  // true
type case3 = IsUnion<[string|number]>  // false
```

答案

```typescript
type IsUnion<T, B = T> = T extends B
   ? [B] extends [T]
     ? false
     : true
   : never;
```

这里利用了 typescript的 [distributive conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types)来区分联合类型

这里要多研究 ～～



### ReplaceKeys

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/1130-medium-replacekeys/README.md)

```typescript
type NodeA = {
  type: 'A'
  name: string
  flag: number
}

type NodeB = {
  type: 'B'
  id: number
  flag: number
}

type NodeC = {
  type: 'C'
  name: string
  flag: number
}


type Nodes = NodeA | NodeB | NodeC

type ReplacedNodes = ReplaceKeys<Nodes, 'name' | 'flag', {name: number, flag: string}> // {type: 'A', name: number, flag: string} | {type: 'B', id: number, flag: string} | {type: 'C', name: number, flag: string} // would replace name from string to number, replace flag from number to string.

type ReplacedNotExistKeys = ReplaceKeys<Nodes, 'name', {aa: number}> // {type: 'A', name: never} | NodeB | {type: 'C', name: never} // would replace name to never
```

答案

```typescript
type ReplaceKeys<T extends Record<string, any>, Key, V extends Record<string, any>> = {
  [K in keyof T]: K extends Key
    ? K extends keyof V
      ? V[K]
      : never
    : T[K]
}
```



### Remove Index Signature

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/1367-medium-remove-index-signature/README.md)

```typescript
typ
type Foo = {
  [key: string]: any;
  foo(): void;
}

type A = RemoveIndexSignature<Foo>  // expected { foo(): void }
```



### Simple Vue

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/6-hard-simple-vue/README.md)

```typescript
const instance = SimpleVue({
  data() {
    return {
      firstname: 'Type',
      lastname: 'Challenges',
      amount: 10,
    }
  },
  computed: {
    fullname() {
      return this.firstname + ' ' + this.lastname
    }
  },
  methods: {
    hi() {
      alert(this.fullname.toLowerCase())
    }
  }
})
```



题目分析，这里我们要定义`SimpleVue` 的类型，data 返回一个对象，这个对象之后可以在this中访问到。computed是一个对象函数，挂在this上，在其中可以访问data的返回值。methods 是一个对象函数可以访问data和computed里的数据

答案

```typescript
type Computed<C> = {
  [K in keyof C]: C[K] extends () => infer R ? R : never
}

declare function SimpleVue<D, C, M>(ops: {
  data: () => D,
  computed: C & ThisType<D>,
  methods: M & ThisType<Computed<C> & D & M>
}): any
```

这里的 有几个点要注意，这种参数相互约束的一般都是使用泛型来实现的。

`ThisType` 这个用法要熟悉，可以看官网的[文档](https://www.typescriptlang.org/docs/handbook/utility-types.html#thistypetype)

`ThisType` 并不会返回一个什么类型，而是用来给上下文this定义类型。比入上文的例子中，在computed中可以使用this访问到data的返回值类型。在methods中可以访问到自己本身以及computed，data里的属性。这里很重要的一点是 methods中使用 自己既是结果类型又是This的类型。在methods中，还可以访问到computed里的属性，由于computed里是 key => function 的形式，我们要将其转化为. key => value type的形式。

官网这个例子就很典型

```typescript
type ObjectDescriptor<D, M> = {
  data?: D;
  methods?: M & ThisType<D & M>; // Type of 'this' in methods is D & M
};

function makeObject<D, M>(desc: ObjectDescriptor<D, M>): D & M {
  let data: object = desc.data || {};
  let methods: object = desc.methods || {};
  return { ...data, ...methods } as D & M;
}

let obj = makeObject({
  data: { x: 0, y: 0 },
  methods: {
    moveBy(dx: number, dy: number) {
      this.x += dx; // Strongly typed this
      this.y += dy; // Strongly typed this
    },
  },
});

obj.x = 10;
obj.y = 20;
obj.moveBy(5, 5);
```



### Currying 1

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/17-hard-currying-1/README.md)

```typescript
const add = (a: number, b: number) => a + b
const three = add(1, 2)

const curriedAdd = Currying(add)
const five = curriedAdd(2)(3)
```

给 `Currying` 函数加类型，每次只能加一个参数

```typescript
type CurryFn<Args, R> = Args extends [infer First, ...infer Rest]
  ? (arg: First) => CurryFn<Rest, R>
  : R
  
declare function Currying<T extends (...args: any) => any>(func: T):
  CurryFn<Parameters<T>, ReturnType<T>>
```

还可以这样写

```typescript
type Unshift<T> = T extends [infer K, ...infer U] ? U : unknown
type Head<T> = T extends [infer K, ...infer U] ? K : unknown

type Curried<T, R> = T extends Array<any>
  ? T['length'] extends 1
    ? (args: Head<T>) => R
    : (args: Head<T>) => Curried<Unshift<T>, R>
  : never

declare function Currying<T extends unknown[], R>(fn: (...args: T) => R): Curried<T, R>
```

其实这里有几个点值得学习，其一是讲泛型简单化，其二是 `T['length'] extends 1`这种用法，第二种用法比第一种用法少递归了一步。



###  Union to Intersection

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/55-hard-union-to-intersection/README.md)

```typescript
type I = Union2Intersection<'foo' | 42 | true> // expected to be 'foo' & 42 & true
```

答案

```typescript
type Union2Intersections<U> = (U extends any ? (arg: U) => any : never) extends ((arg: infer I) => void) ? I : never
```

这个题目没啥思路，

这里， `U extends any ? (arg: U) =>any :never`的结果是两个 函数类型的 联合类型，但是最后这一句，怎么就 变成交叉类型了。

在[issue](https://github.com/type-challenges/type-challenges/issues/775)里可以看到解释

1. `U extends infer R ? (x: R) => any : never` will generate the union of functions like `(x: 'foo') => any | (x: 42) => any | (x: true) => any`.
2. `extends (x: infer V) => any ? V : never` will find the function that is superset of above union. The function that satisfy the condition is that `(x: 'foo' & 42 & true) => any`
3. you get the answer. It is the type of the argument of obtained function.



Em，就很有意思

```typescript

type SuperSet<T> = T extends (x: infer V) => any ? V : never;
type T4 = (((x: { foo: string }) => any) | (( x: { bar: string }) => any));
type T5 = SuperSet<T4>;                               // T5:     { foo: string; } | { bar: string; }
type T6 = T4 extends (x: infer V) => any ? V : never; // T6:     { foo: string; } & { bar: string; }
```

好家伙



### Get Required

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/57-hard-get-required/README.md)

```typescript
type I = GetRequired<{ foo: number, bar?: string }> // expected to be { foo: number }
```

答案

利用后面的 `RequiredKeys`就很容易实现了

```typescript
type GetRequired<T> = {
  [K in RequiredKeys<T>]: T[K]
}
```



### Required keys

[题目](https://github.com/type-challenges/type-challenges/blob/master/questions/89-hard-required-keys/README.md)

```typescript
type Result = RequiredKeys<{ foo: number; bar?: string }>;
// expected to be “foo”
```

答案

```typescript
type RequiredKeys<T> = {
    [K in keyof T]-?: T extends Record<K, T[K]> ? K : never
}[keyof T];
```

这里一定要注意

```typescript
type RequiredKeys<T> = {
    [K in keyof T]: T extends Record<K, T[K]> ? K : never
}[keyof T];

type RequiredKeys<T> = {
	[K in keyof T]: undefined extends T[k] ? never : K
}
```

上面两种写法，都会使得结果 结果 多一个 `undefined`, 因为有非必填项

其实 除了keyof 还可以使用另一种形式

```typescript
type RequiredKeys<T> = keyof T extends infer K
  ? K extends keyof T
    ? T[K] extends Required<T>[K]
      ? K
      : never
    : never
  : never
```
