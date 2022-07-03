---
title: Rethink vue composition api
date: 2021-06-14 10:33:34
description: 对于composition api的一些反思
---

对 vue3的composition api 进行了一些反思和总结，总结了一些经验和实践，特此记录。<!--more-->

## 逻辑抽离与关注点分离

Vue2 使用 options api，根据 类型将逻辑分成了 `data`, `computed`, `watch`, `methods` 几个部分，在vue官网中对这种方式进行了反思，这种根据类型 组织代码的方式在 逻辑比较复杂的时候会变得很难理解，经常会为了一个逻辑不得不翻看大段代码。composition api 就是为了解决这么一个问题，将 一个 逻辑关注点(logic concern)组织到一个 composition api中，在一个 composition api中可以有 `data`, `computed`, `watch`, `methods`。可以参考[文档](https://v3.vuejs.org/guide/composition-api-introduction.html#why-composition-api)

### 组合

composition api 归根结底还是一个函数，一个composition api 只做一件事，一个复杂的逻辑可以使用多个composition api组合而成。这样可以使得逻辑更加独立，提高复用性，体现专注点分离。

比如 [vueuse](https://vueuse.org/) 中 的 [useDark](https://vueuse.org/core/useDark/) 实现了 响应式的 dark mode 以及持久化

```typescript
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()
const toggleDark = useToggle(isDark)
```

useDark 实际上内部使用了 `usePreferredDark` 和 `useStorage` ，前者是使用媒体查询来确定是否为dark模式，后者则是实现了数据的持久化。

```typescript
function useDark(options: UseDarkOptions = {}) {
  const {
    selector = 'html', // css selector for target element applying to
    attribute = 'class', // HTML attribute applying the target element
    valueDark = 'dark', // value applying to the target element when isDark = true
    valueLight = '', // value applying to the target element when isDark = false
    window = defaultWindow,
    storage = defaultWindow?.localStorage, // storage object, 
    storageKey = 'vueuse-color-scheme', // key to persist the data
    listenToStorageChanges = true,
  } = options

  const preferredDark = usePreferredDark({ window })
  const store = storageKey == null
    ? ref<ColorSchemes>('auto')
    : useStorage<ColorSchemes>(storageKey, 'auto', storage, { window, listenToStorageChanges })

  const isDark = computed<boolean>({
    get() {
      return store.value === 'auto'
        ? preferredDark.value
        : store.value === 'dark'
    },
    set(v) {
      if (v === preferredDark.value)
        store.value = 'auto'
      else
        store.value = v ? 'dark' : 'light'
    },
  })

  const onChanged = options.onChanged || ((v: boolean) => {
    const el = window?.document.querySelector(selector)
    if (attribute === 'class') {
      el?.classList.toggle(valueDark, v)
      if (valueLight)
        el?.classList.toggle(valueLight, !v)
    }
    else { el?.setAttribute(attribute, v ? valueDark : valueLight) }
  })

  watch(isDark, onChanged, { flush: 'post' })

  tryOnMounted(() => onChanged(isDark.value))

  return isDark
}

```

可以看到，使用了 `usePreferredDark` 获取到 初始值（按照设计，如果在storage里读不到内容，就会使用 system preferences）。然后使用了 `useStorage` 来从 storage里读取指定key 的值。整个函数返回的是一个 computed value, 在修改它的时候会给target 设置属性。

接下来看下 `usePreferredDark`

```typescript
export function usePreferredDark(options?: ConfigurableWindow) {
  return useMediaQuery('(prefers-color-scheme: dark)', options)
}
```

可以看到，这是是调用了 `useMediaQuery` 

```typescript
/**
 * Reactive Media Query.
 *
 * @link https://vueuse.org/useMediaQuery
 * @param query
 * @param options
 */
export function useMediaQuery(query: string, options: ConfigurableWindow = {}) {
  const { window = defaultWindow } = options
  if (!window)
    return ref(false)

  const mediaQuery = window.matchMedia(query)
  const matches = ref(mediaQuery.matches)

  const handler = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }

  if ('addEventListener' in mediaQuery) {
    mediaQuery.addEventListener('change', handler)
  }
  else {
    // @ts-expect-error - fallback for Safari < 14 and older browsers
    mediaQuery.addListener(handler)
  }

  tryOnUnmounted(() => {
    if ('removeEventListener' in mediaQuery) {
      mediaQuery.removeEventListener('change', handler)
    }
    else {
      // @ts-expect-error - fallback for Safari < 14 and older browsers
      mediaQuery.removeListener(handler)
    }
  })

  return matches
}
```

可以看到 `useMediaQuery` 的实现也很简单，是使用 `window.matchMedia`获取初始值，然后使用事件来处理变化实现响应式的。这也是 将 普通变量转化为响应式变量最常见的一种模式

接下来看下 `useStorage`

```typescript
/**
 * Reactive LocalStorage/SessionStorage.
 *
 * @link https://vueuse.org/useStorage
 * @param key
 * @param defaultValue
 * @param storage
 * @param options
 */
export function useStorage<T extends(string|number|boolean|object|null)> (
  key: string,
  defaultValue: T,
  storage: StorageLike | undefined = defaultWindow?.localStorage,
  options: StorageOptions = {},
) {
  const {
    flush = 'pre',
    deep = true,
    listenToStorageChanges = true,
    window = defaultWindow,
    eventFilter,
  } = options

  const data = ref<T>(defaultValue)

  const type = defaultValue == null
    ? 'any'
    : typeof defaultValue === 'boolean'
      ? 'boolean'
      : typeof defaultValue === 'string'
        ? 'string'
        : typeof defaultValue === 'object'
          ? 'object'
          : Array.isArray(defaultValue)
            ? 'object'
            : !Number.isNaN(defaultValue)
              ? 'number'
              : 'any'

  function read() {
    if (!storage)
      return

    try {
      let rawValue = storage.getItem(key)
      if (rawValue == null && defaultValue) {
        rawValue = Serializers[type].write(defaultValue)
        storage.setItem(key, rawValue)
      }
      data.value = Serializers[type].read(rawValue, defaultValue)
    }
    catch (e) {
      console.warn(e)
    }
  }

  read()

  if (window && listenToStorageChanges)
    useEventListener(window, 'storage', read)

  watchWithFilter(
    data,
    () => {
      if (!storage) // SSR
        return

      try {
        if (data.value == null)
          storage.removeItem(key)
        else
          storage.setItem(key, Serializers[type].write(data.value))
      }
      catch (e) {
        console.warn(e)
      }
    },
    {
      flush,
      deep,
      eventFilter,
    },
  )

  return data
}
```

`Serializers` 定义了不同js类型的序列化与反序列化的方法， 这里的模式是一样的，使用 read读区默认值，使用事件监听变化。

### 组织

composition api 是一个函数，有输入，输出，从 options api转过来的开发者一定会有这样的一个疑问？到底要怎么样拆分呢？有一些变量需要多个逻辑块共用，这种情况应该怎么处理呢？

这里，引用 antfu在 vue conf 的一个结论: **在setup 中，我们建立输入和输出的连接**。这句话要多理解。



## 函数的参数

Composition api 归根结底是函数，函数是可以接收参数的，有时候这个参数是不会变的，有时候是需要考虑参数的变化的。

### 不考虑参数变化

如果不考虑参数变化的话，一般传入的是 初始值或者一些配置化的参数（比如useBreakpoints）。

比如前面提到过的 `useStorage` 

```typescript
import { useStorage } from '@vueuse/core'

// bind object
const state = useStorage('my-store', { hello: 'hi', greeting: 'Hello' })

// bind boolean
const flag = useStorage('my-flag', true) // returns Ref<boolean>

// bind number
const count = useStorage('my-count', 0) // returns Ref<number>

// bind string with SessionStorage
const id = useStorage('my-id', 'some-string-id', sessionStorage) // returns Ref<string>

// delete data from storage
state.value = null
```

这种情况下一般会返回一个响应式的变量

### 考虑参数变化

有时候，传给composition api 的参数是变化的，这就要求composition api 内部能够处理这种变化。总结一下有以下几个场景

#### 传递一个`ref`

在已经有一个ref 变量的情况下，直接将ref 变量传递给 composition api, 可以直接修改外部变。这里以 `useTitle`为例。`useTitle` 可以接收一个字符串 或者一个ref 作为参数。

   ```typescript
   /**
    * Reactive document title.
    *
    * @link https://vueuse.org/useTitle
    * @param newTitle
    * @param options
    */
   export function useTitle(
     newTitle: MaybeRef<string | null | undefined> = null,
     { document = defaultDocument }: ConfigurableDocument = {},
   ) {
     const title = ref(newTitle ?? document?.title ?? null)
   
     watch(
       title,
       (t, o) => {
         if (isString(t) && t !== o && document)
           document.title = t
       },
       { immediate: true },
     )
   
     return title
   }
   ```

   可以看到 这里的参数类型是 `MaybeRef<string | null | undefined>` ，`MaybeRef` 的声明如下

   ```typescript
   type MybeRef<T> = T | Ref<T> | ComputedRef<T>
   ```

   在 `useTitle` 中，会根据 函数参数定义一个 新的 Ref。

   ```typescript
   const title = ref(newTitle ?? document?.title ?? null)
   ```

   这行代码 内容非常丰富，由于 newTitle可能为null，如果为null的情况下，就会从 `document.title` 上取。如果 newTitle 不是null，如果newTitle是 `string` 的话，就会创建一个 初始值为 newTitle 的`ref`，如果newTitle 是 `Ref<string>`的话，title 与 newTitle 是一样的。

   这得益于 `ref` 的实现，如果传入的参数是一个 `Ref` 的话，就会直接返回。这一点在源码中可以看出

```typescript
export function ref(value?: unknown) {
	return createRef(value)
}
function createRef(rawValue: unknown, shallow = false) {
	if (isRef(rawValue)) {
		return rawValue
	}
	return new RefImpl(rawValue, shallow)
}
```

#### 传递一个函数

在一些简单的情况下，可以通过传递一个函数来实现动态参数。

   ```typescript
   const { data, error } = useFetch(() => `/api/user/${props.name}`)
   ```

   实现上

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

但是这种只适合于少量参数的情况，实际上 vueuse的 [useFetch](https://vueuse.org/core/usefetch/)还是使用的 传递ref 变量的形式。

​```typescript
const url = ref('https://my-api.com/user/1') 

const { data } = useFetch(url, { refetch: true })
   ```



## 函数的返回值

#### 返回响应式变量

前文举例的大多数都是这种格式，此处不再举例。

#### 返回创建响应式变量的方法

典型的如 `useBreakpoints`

使用方式如下

```typescript
import { useBreakpoints } from '@vueuse/core'

const breakpoints = useBreakpoints({
  tablet: 640,
  laptop: 1024,
  desktop: 1280,
})

const laptop = breakpoints.between('laptop', 'desktop') // reactive
```

这里，`useBreakpoints`其实只是一个普通的函数，利用闭包 返回了 一些 工具方法，这些工具方法会得到 响应式变量。

```typescript
/**
 * Reactively viewport breakpoints
 *
 * @link https://vueuse.org/useBreakpoints
 * @param options
 */
export function useBreakpoints<K extends string>(breakpoints: Breakpoints<K>, options: ConfigurableWindow = {}) {
  function getValue(k: K, delta?: number) {
    let v = breakpoints[k]

    if (delta != null)
      v = increaseWithUnit(v, delta)

    if (typeof v === 'number')
      v = `${v}px`

    return v
  }

  const { window = defaultWindow } = options

  function match(query: string): boolean {
    if (!window)
      return false
    return window.matchMedia(query).matches
  }

  return {
    greater(k: K) {
      return useMediaQuery(`(min-width: ${getValue(k)})`, options)
    },
    smaller(k: K) {
      return useMediaQuery(`(max-width: ${getValue(k, -0.1)})`, options)
    },
    between(a: K, b: K) {
      return useMediaQuery(`(min-width: ${getValue(a)}) and (max-width: ${getValue(b, -0.1)})`, options)
    },
    isGreater(k: K) {
      return match(`(min-width: ${getValue(k)})`)
    },
    isSmaller(k: K) {
      return match(`(max-width: ${getValue(k, -0.1)})`)
    },
    isInBetween(a: K, b: K) {
      return match(`(min-width: ${getValue(a)}) and (max-width: ${getValue(b, -0.1)})`)
    },
  }
}
```

#### 即返回响应式变量，又返回工具方法

典型的比如 [useFetch](https://vueuse.org/core/useFetch/)

请求数据不仅需要url，还要指定请求方法，还需要制定request 的content-type，这些参数如果以函数参数的形式传入，会让api变得臃肿不堪。vueuse使用了链式调用的方式来设置各个参数，看起来非常优雅。

```typescript
// Request with default config
const { isFetching, error, data } = useFetch(url)

// Request will be sent with GET method and data will be parsed as JSON
const { data } = useFetch(url).get().json()

// Request will be sent with POST method and data will be parsed as text
const { data } = useFetch(url).post().text()

// Or set the method using the options

// Request will be sent with GET method and data will be parsed as blob
const { data } = useFetch(url, { method: 'GET' }, { refetch: true }).blob()
```

`useFetch` 的实现也不难

```typescript
export function useFetch<T>(url: MaybeRef<string>, ...args: any[]): UseFetchReturn<T> {
  const supportsAbort = typeof AbortController === 'function'

  let fetchOptions: RequestInit = {}
  let options: UseFetchOptions = { immediate: true, refetch: false }
  // 默认配置
  const config = {
    method: 'get',
    type: 'text' as DataType,
    payload: undefined as unknown,
    payloadType: 'json' as PayloadType,
  }
  let initialized = false

  // 处理多个参数
  if (args.length > 0) {
    if (isFetchOptions(args[0]))
      options = { ...options, ...args[0] }
    else
      fetchOptions = args[0]
  }

  if (args.length > 1) {
    if (isFetchOptions(args[1]))
      options = { ...options, ...args[1] }
  }

  const {
    fetch = defaultWindow?.fetch,
  } = options

  // 定义响应式变量
  const isFinished = ref(false)
  const isFetching = ref(false)
  const aborted = ref(false)
  const statusCode = ref<number | null>(null)
  const response = shallowRef<Response | null>(null)
  const error = ref<any>(null)
  const data = shallowRef<T | null>(null)

  // 取消相关
  const canAbort = computed(() => supportsAbort && isFetching.value)

  let controller: AbortController | undefined

  const abort = () => {
    if (supportsAbort && controller)
      controller.abort()
  }

  // 发出请求的方法
  const execute = async() => {
    initialized = true
    isFetching.value = true
    isFinished.value = false
    error.value = null
    statusCode.value = null
    aborted.value = false
    controller = undefined

    if (supportsAbort) {
      controller = new AbortController()
      controller.signal.onabort = () => aborted.value = true
      fetchOptions = {
        ...fetchOptions,
        signal: controller.signal,
      }
    }

    const defaultFetchOptions: RequestInit = {
      method: config.method,
      headers: {},
    }

    if (config.payload) {
      const headers = defaultFetchOptions.headers as Record<string, string>
      if (config.payloadType === 'json') {
        defaultFetchOptions.body = JSON.stringify(config.payload)
        headers['Content-Type'] = 'application/json'
      }
      else {
        defaultFetchOptions.body = config.payload as any
        headers['Content-Type'] = config.payloadType === 'formData'
          ? 'multipart/form-data'
          : 'text/plain'
      }
    }

    let isCanceled = false
    const context: BeforeFetchContext = { url: unref(url), options: fetchOptions, cancel: () => { isCanceled = true } }

    if (options.beforeFetch)
      Object.assign(context, await options.beforeFetch(context))

    if (isCanceled || !fetch)
      return Promise.resolve()

    return new Promise((resolve) => {
      fetch(
        context.url,
        {
          ...defaultFetchOptions,
          ...context.options,
          headers: {
            ...defaultFetchOptions.headers,
            ...context.options?.headers,
          },
        },
      )
        .then(async(fetchResponse) => {
        	// 修改响应式变量
          response.value = fetchResponse
          statusCode.value = fetchResponse.status

          await fetchResponse[config.type]().then(text => data.value = text as any)

          // see: https://www.tjvantoll.com/2015/09/13/fetch-and-errors/
          if (!fetchResponse.ok)
            throw new Error(fetchResponse.statusText)

          resolve(fetchResponse)
        })
        .catch((fetchError) => {
          error.value = fetchError.message || fetchError.name
        })
        .finally(() => {
          isFinished.value = true
          isFetching.value = false
        })
    })
  }

  // 处理函数参数ref的变化
  watch(
    () => [
      unref(url),
      unref(options.refetch),
    ],
    () => unref(options.refetch) && execute(),
    { deep: true },
  )

  const base: UseFetchReturnBase<T> = {
    isFinished,
    statusCode,
    response,
    error,
    data,
    isFetching,
    canAbort,
    aborted,
    abort,
    execute,
  }

  // 将数据和链式调用的方法一并放回
  const shell: UseFetchReturn<T> = {
    ...base,

    get: setMethod('get'),
    put: setMethod('put'),
    post: setMethod('post'),
    delete: setMethod('delete'),

    json: setType('json'),
    text: setType('text'),
    blob: setType('blob'),
    arrayBuffer: setType('arrayBuffer'),
    formData: setType('formData'),
  }

  function setMethod(method: string) {
    return (payload?: unknown, payloadType?: PayloadType) => {
      if (!initialized) {
        config.method = method
        config.payload = payload
        config.payloadType = payloadType || typeof payload === 'string' ? 'text' : 'json'
        return shell as any
      }
      return undefined
    }
  }

  function setType(type: DataType) {
    return () => {
      if (!initialized) {
        config.type = type
        return base as any
      }
      return undefined
    }
  }

  // 将请求放入宏任务队列，比链式调用后执行
  if (options.immediate)
    setTimeout(execute, 0)

  return shell
}
```

#### 返回`cleanup` 函数

典型地如 `useEventListener` 就返回了解除绑定的函数, 一般用在 使用事件绑定的函数中。

以 `onClickOutside`为例

```typescript
export function useEventListener(...args: any[]) {
  let target: MaybeRef<EventTarget> | undefined
  let event: string
  let listener: any
  let options: any

  if (isString(args[0])) {
    [event, listener, options] = args
    target = defaultWindow
  }
  else {
    [target, event, listener, options] = args
  }

  if (!target)
    return noop

  let cleanup = noop

  const stopWatch = watch(
    () => unref(target),
    (el) => {
      cleanup()
      if (!el)
        return

      el.addEventListener(event, listener, options)

      cleanup = () => {
        el.removeEventListener(event, listener, options)
        cleanup = noop
      }
    },
    { immediate: true, flush: 'post' },
  )

  const stop = () => {
    stopWatch()
    cleanup()
  }

  tryOnUnmounted(stop)

  return stop
}
```


本文从函数的结构上分析了一下 composition api, 当然composition api还有一些固定的模式可以学习，可以查看下一篇文章。
