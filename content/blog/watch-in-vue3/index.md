---
title: Vue3中的watch执行时机
date: 2021-03-07 15:26:11
description: watch的回调到底是在什么时候执行的
---

近日，在写一个Vue3相关的东西，在使用watch的时候，遇到了一些问题，在查看文档已经翻看源码之后，对watch的实现和机制有了更深的理解，此处做一个记录。

<!--more-->

背景是，想在vue3中想把给dom绑定事件抽离成一个 composition api，代码如下

```typescript
function useEventListener(target: Element | window, event: string, listener: EventListener, options?: AddEventListenerOptions) {
  if (!target) return

	const add = () => {
		target.addEventListener(event, listener, options)
	}
	const remove = () => {
		target.removeEventListener(event, listener, options)	
	}

	add()
  onUnmounted(remove)

  return stop
}
```

实现非常简单, 传进来一个dom， 给他绑定事件，然后在onUnmounted的时候把事件卸载了。

使用时需要把真实dom传递给函数，在vue3中需要在onMounted的时候才能获取到真实dom。

```typescript
setup() {
	const root: Ref<HTMLElement | null> = ref(null)

	onMounted(() => {
		useEventListener(root.value, 'click', () => {
			console.log('clicked')
		})
	})
	
	return {
		root
	}
}
```

这样就显得很麻烦。

能不能让useEventListner的el参数支持一下Ref<HTMLElement>， vue支持template ref， 可以使用watch监听ref值的变化（当然也可以根据el的取值类型，决定是否使用声明周期来绑定）。

```typescript
type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

function useEventListener(el: MaybeRef<EventTarget|null>, event: string, listener: EventListener, options?: AddEventListenerOptions) {
	if (!target) return

	let cleanup = () => {}
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
    { immediate: true },
  )

  const stop = () => {
    stopWatch()
    cleanup()
  }
	onUnmounted(stop)
}
```

template ref 赋值的时候，会触发watch，在watch的回调中可以给dom绑上事件。

```html
<template>
	<p ref="contentRef">content</p>
</template>

<script>
import { ref } from 'vue'

export default {
	setup() {
		const contentRef = ref(null)
		useEvnetListener(titleRef, 'click', () => {
			console.log('clicked')
		})
		return {
			contentRef
		}
	}
}
</script>
```

上面的代码中，当contentRef被赋值的时候，触发watch，在watch的时候会给dom绑定事件。这一切都挺合理的。

然而发现，如果一个ref 是绑定在一个 带有v-if的元素上时，切换v-if的值，就会发现，事件没有绑定上去。代码如下

```html
<template>
	<p v-if="show" ref="contentRef">content</p>
	<button @click="toggle">change</button>
</template>

<script>
export default {
	setup() {
		const show = ref(false)
		const contentRef = ref(null)
		const toggle = () => {
			show.value = !show.value
		}
		useEventListener(contentRef, 'click', () => {
			console.log('clicked')
		})
		return {
			show,
			contentRef,
			toggle
		}
	}
}
</script>
```

事件没绑定上去，是不是因为watch 没有监测到呢？于是测试了一下

```javascript
setup() {
		const show = ref(false)
		const contentRef = ref(null)
		const toggle = () => {
			show.value = !show.value
		}
		watch(() => unref(contentRef), (el) => {
			console.log(el)
		}, { immediate: true })
		return {
			show,
			contentRef,
			toggle
		}
}
```

预计结果如下

```javascript
null // 第一次
// 切换为显示
<p>content</p>
// 切换为隐藏
null
```

但是实际情况却不一样，结果如下

```javascript
null // 第一次
// 切换为显示
// 没有任何打印结果
// 切换为隐藏
<p>content<p>
// 切换为显示
null
// 切换为隐藏
<p>content<p>
```

可以看到实际结果看起来晚了一个“周期”

这着实让人费解？于是看了下实现

这里先看下watch的实现吧，以下代码均为与上面用例相关的核心逻辑

```javascript
const doWatch = (source, cb, { immediate, deep, flush }, instance) => {
	// 实际getter会根据source的类型有不同的取值
	let getter
	if (isFunction(source)) {
		getter = () => source
	}
	let oldValue = INITIAL_WATCHER_VALUE
	const job = () => {
		if (cb) {
			const newValue = runner()
			callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onInvalidate
        ])
        oldValue = newValue
		}
	}
	
	let scheduler
  if (flush === 'sync') {
    scheduler = job
  } else if (flush === 'post') {
    scheduler = () => queuePostRenderEffect(job, instance && instance.suspense)
  } else {
    // default: 'pre'
    scheduler = () => {
      if (!instance || instance.isMounted) {
        queuePreFlushCb(job)
      } else {
        // with 'pre' option, the first call must happen before
        // the component is mounted so it is called synchronously.
        job()
      }
    }
  }

	const runner = effect(getter, {
    lazy: true,
    onTrack,
    onTrigger,
    scheduler
  })
	
	// initial run
  if (cb) {
    if (immediate) {
      job()
    } else {
      oldValue = runner()
    }
  }
}
```

可以看到watch的核心就是一个 带有scheduler的effect。当effect依赖的变量发生变化时，scheduler会接管依赖变化之后的逻辑。

在这个job中会根据flush的值将回调放入不同的队列中去，由于没有指定flush，这里会进入default的逻辑，也就是在未挂载的情况下会直接同步执行job，在已经挂载了的情况下会将回调放到preFlushQueue中。

那ref是什么时候更新的呢，无论是初次渲染还是更新渲染都会调用patch， 在patch的过程中会设置ref。

```javascript
const prodEffectOptions = {
  scheduler: queueJob,
  allowRecurse: true
}

instance.update = effect(() => {
	patch()
}, prodEffectOptions)
```

这里仍然是一个自定义scheduler的effect，在更新的时候，会调用queueJob。

vue的调度队列有三个

```javascript
const queue = []
const pendingPreFlushCbs = []
const pendingPostFlushCbs = []
const queueJob = (job) => {
	if (
    (!queue.length ||
      !queue.includes(
        job,
        isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex
      )) &&
    job !== currentPreFlushParentJob
  ) {
    const pos = findInsertionIndex(job)
    if (pos > -1) {
      queue.splice(pos, 0, job)
    } else {
      queue.push(job)
    }
    queueFlush()
  }
} 
```

就是将任务加入到queue中，然后刷新queue。

用promise.then把刷新队列任务加入微任务中。

```javascript
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}
```

flushJobs清理所有的queue

```typescript
function flushJobs(seen?: CountMap) {
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }

  flushPreFlushCbs(seen)

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child so its render effect will have smaller
  //    priority number)
  // 2. If a component is unmounted during a parent component's update,
  //    its update can be skipped.
  queue.sort((a, b) => getId(a) - getId(b))

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job) {
        if (__DEV__) {
          checkRecursiveUpdates(seen!, job)
        }
        callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
      }
    }
  } finally {
    flushIndex = 0
    queue.length = 0

    flushPostFlushCbs(seen)

    isFlushing = false
    currentFlushPromise = null
    // some postFlushCb queued jobs!
    // keep flushing until it drains.
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs(seen)
    }
  }
}
```

从上面的代码中可以看到，queue的执行顺序是：

1. 清理pendingPreFlushQueue
2. 清理queue
3. 清理 pendingPostFlushQueue

到这里，我们就把所有的线路连起来了。可以来分析一下 watch template ref 的整体流程。

先来看下没有v-if的情况。

1. watch immediate, 打印null
2. 将渲染任务加入到queue中。在微任务的执行时机将所有的任务队列清空，先清理pendingPreFlushQueue,  然后清理queue，在这个过程中会调用patch将vnode 渲染为dom，同时会设置ref的值，当设置了contentRef的时候，触发了watch的更新，也就是1中的scheduler，此时实例还没有渲染完成，所以同步的方式打印出dom。

再来思考一下带有v-if的清空

1. watch immediate, 打印null
2. 将渲染任务加入到queue中。在微任务的执行时机将所有的任务队列清空，先清理pendingPreFlushQueue,  然后清理queue，在这个过程中会调用patch将vnode 渲染为dom，由于show为false，所以ref的值没有发生变化。
3. 用户点击将show 变为true，此时会将渲染任务加到queue中，在微任务的执行时机将所有的任务队列清空，先清理pendingPreFlushQueue,  然后清理queue，在这个过程中会调用patch更新dom，由于show为true，所以ref的值是会被设置的，在设置之后，会触发watch effect的scheduler，此时实例已经mounted了，所以会将回调任务放入到 pendingPreFlushQueue中（但此时已经清理过了)，再清空pendingPostFlushQueue。
4. 将show 变为false，此时会将渲染任务加到queue中，在微任务的执行时机将所有的任务队列清空，先清理pendingPreFlushQueue，此时pendingPreFlushQueue中有步骤2中watch effect scheduler推进来的回调任务，此时watch 的回调函数被执行，打印了dom。  然后清理queue，在这个过程中会调用patch更新dom，由于show为false，所以ref的值会被设置为空，在设置之后，会触发watch effect的scheduler，由于实例已经mounted了，所以会将回调任务放入到 pendingPreFlushQueue中（但此时已经清理过了)。再清空pendingPostFlushQueue。

所以看起来，如果有v-if 的清空下，ref 监听会慢一拍。

那如何修复这个问题呢？其实看完上面的分析，应该就能知道了，那就是给watch 加上`flush: 'post'，`这样就能保证能在每次dom更新（设置ref）之后再调用回调。

其实如果用老一些的vue版本（比如vue3.0.0）的话，不写 `flush: 'post'` 也没有问题，这是因为 vue早期版本watch 的flush默认是post, 在这种情况下，watch的dom ref 是没有问题的，但是之后因为一些其他问题，具体可以看到[issue](https://github.com/vuejs/vue-next/issues/1706#issuecomment-666258948\) 和[commit](https://github.com/vuejs/vue-next/commit/49bb44756fda0a7019c69f2fa6b880d9e41125aa)。
