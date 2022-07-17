---
title: 如何处理composition api的动态参数
date: 2022-07-17 19:00:00
description: compisition api 如何应对会变化的
---

之前笔者写过一篇文章[composition api 的参数传递](/dynamic-params-in-composition-api/) 讲到过在 vue composition api 中应该如何处理动态的参数，建议读者在阅读本文前，先阅读之前的那篇文章。

起因在看到 [vueuse 的issue](https://github.com/vueuse/vueuse/issues/1812)， 笔者认领了一个 `useAverage` 的需求，然后开始编码。这个函数的功能很简单，就是根据参数算一个平均值。最开始的代码大概如下

```ts
function useAverage(array: MaybeRef<number>[]) {
  const arr = unref(array)
  return arr.reduce((sum, cur) => sum + cur, 0) / arr.length
}
```

这个看起来没什么问题，但是，我们少考虑了一些场景，比如

```ts
const num = ref(5)
const arr = ref([1, num, 10])

// or
const arr = [1, num, 5]

const avg = useAverage(arr)
```
可以看到，此时，数组中某一个元素是一个 ref，这种情况，之前的实现是不能够处理的。于是，稍微修改一下

```ts
function useAverage(array: MaybeRef<MaybeRef<number>[]>) {
  return computed(() => {
    const arr = unref(array)
    return arr.reduce((sum, cur) => sum + unref(cur), 0) / arr.length
  })
}
```

到这里，或许就可以了，但是vueuse关于参数的响应式做得更加精确一些，他提供了一个 `MaybeComputedRef` 

```ts
/**
 * Maybe it's a ref, or a plain value
 *
 * ```ts
 * type MaybeRef<T> = T | Ref<T>
 * ```
 */
export type MaybeRef<T> = T | Ref<T>

/**
 * Maybe it's a ref, or a plain value, or a getter function
 *
 * ```ts
 * type MaybeComputedRef<T> = T | Ref<T> | (() => T)
 * ```
 */
export type MaybeComputedRef<T> = T extends () => void
  ? never
  : (() => T) | MaybeRef<T>
```

可以看到 `MaybeComputedRef` 除了 `MaybeRef` 还包含了一个 `getter` 函数。对应的从 `MaybeComputedRef`获取最终值也有一个方法`resolveUnref`

```ts
/**
 * Normalize value/ref/getter to `ref` or `computed`.
 */
export function resolveUnref<T>(r: MaybeComputedRef<T>): T {
  return typeof r === 'function'
    ? (r as any)()
    : unref(r)
}

```

基于此，我们使用 `MaybeComputedRef`替换掉 `MaybeRef`

```ts
function useAverage(array: MaybeComputedRef<MaybeComputedRef<number>[]>) {
  return computed(() => {
    const arr = resolveUnref(array)
    return arr.reduce((sum, cur) => sum + resolveUnref(cur), 0) / arr.length
  })
}
```

写到这里，就好像已经很符合要求了，而且补充了 test cases，就提交了 [pr](https://github.com/vueuse/vueuse/pull/1826)。有趣的是作者还对这种处理参数的方式表示了赞同，所以这个pr很快就被合并
了。

由于当时各个pr对于函数参数的处理各部相同，在正式发布的时候，作者就将这种动态参数再次做了一个抽象，见 [refactor(math): extract common utils](https://github.com/vueuse/vueuse/commit/5e141277e340b7b563ce7495707f6258e725d450)，新增支持同时传入多个 单个响应式变量 作为参数。

```ts
import type { MaybeComputedRef } from '@vueuse/shared'
import { resolveUnref } from '@vueuse/shared'

export type MaybeComputedRefArgs<T> = MaybeComputedRef<T>[] | [MaybeComputedRef<MaybeComputedRef<T>[]>]

export function resolveUnrefArgsFlat<T>(args: MaybeComputedRefArgs<T>): T[] {
  return args
    .flatMap((i: any) => {
      const v = resolveUnref(i)
      if (Array.isArray(v))
        return v.map(i => resolveUnref(i))
      return [v]
    })
}
```

函数的实现也变成了 

```ts
export function useAverage(array: MaybeComputedRef<MaybeComputedRef<number>[]>): ComputedRef<number>
export function useAverage(...args: MaybeComputedRef<number>[]): ComputedRef<number>

/**
 * Get the average of an array reactively
 *
 * @see https://vueuse.org/useAverage
 */
export function useAverage(...args: MaybeComputedRefArgs<number>): ComputedRef<number> {
  return computed(() => {
    const array = resolveUnrefArgsFlat(args)
    return array.reduce((sum, v) => sum += v, 0) / array.length
  })
}
```

再看下test case

```ts
it('should work with rest', () => {
    const a = ref(1)
    const b = ref(2)
    const sum = useAverage(a, () => b.value, 3)
    expect(sum.value).toBe(2)
    b.value = 11
    expect(sum.value).toBe(5)
    a.value = 10
    expect(sum.value).toBe(8)
})
```

这样的话，就同时支持了单个参数和多个参数了，功能更加完整了。
