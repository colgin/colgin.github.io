---
title: composition api 的参数传递
date: 2021-06-13 19:18:22
description: vue composition api 的参数传递有什么讲究？
---

Composition api 提供了新的逻辑抽象的方式，在代码的组织，抽离方面对于开发者要求更高了，本文将探讨，如果将参数传递给 Composition api. <!-- more -->

## 背景

以一个请求数据的composition api为例。

```typescript
function useFetch(url) {
	const data = ref(null)
	const error = ref(null)
	const isPending = ref(true)

	fetch(url)
		.then(res => res.json())
		.then(_data => {
			data.value = _data
			isPending = false
		})
		.catch(err => {
			error.value = err
			isPending = false
		})

	return {
		data,
		error,
		isPending
	}
}
```

使用时，比如这里，我们使用 useFetch来获取用户信息

```typescript
const { data, error, isPending } = useFetch('/api/user/ryan')
```

但是，如果，用户名是动态的，比如，来自props，或者其他变量呢？

```typescript
const { data, error, isPending } = useFetch(`/api/user/${props.name}`)
```

这样只会调用请求一次，之后 `props.name` 变化之后，并不会重新拉接口。

可以将参数设置为一个函数

```typescript
function useFetch(getUrl) {
	const data = ref(null)
	const error = ref(null)
	const isPending = ref(true)

	const url = computed(() => getUrl())
	watch(url, (value) => {
		isPending.value = true
		data.value = null
		error.value = null
		fetch(value)
			.then(res => res.json())
			.then(_data => {
				data.value = _data
				isPending = false
			})
			.catch(err => {
				error.value = err
				isPending = false
			})
	}, { immediate: true })

	return {
		data,
		error,
		isPending
	}
}
```

使用时

```typescript
const { data, error } = useFetch(() => `/api/user/${props.name}`)
```

这样就能在`props.name` 改变时，自动请求了。

有没有简单一些的方法呢？可以使用 `watchEffect`

```typescript
function useFetch(getUrl) {
	const data = ref(null)
	const error = ref(null)
	const isPending = ref(true)

	watchEffect(() => {
		isPending.value = true
		data.value = null
		error.value = null
		fetch(getUrl())
			.then(res => res.json())
			.then(_data => {
				data.value = _data
				isPending = false
			})
			.catch(err => {
				error.value = err
				isPending = false
			})
	})

	return {
		data,
		error,
		isPending
	}
}
```

`watchEffect` 会自动收集effect中的依赖，并且 `watchEffect` 执行时，effect 必会执行一次（效果与 watch 的 immediate: true 一样)。在上面的实现中，在`watchEffect`中 会调用 getUrl 函数，在这个函数中，会访问 `props.name`, 由于 `props` 时 `shallowReactive` 的，所以会被收集依赖，当 `props.name` 改变时，effect 会执行一次。这样就能轻松实现 `props.name` 改变时自动请求的需求了。
