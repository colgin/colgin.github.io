---
title: Vue Composition Api中常见的几种模式
date: 2021-06-22 23:30:52
description: 写composition api的常用套路
---

看了下vueuse的实现，开拓了一下视野，不仅仅是学习到了composition api封装的模式，更有代码组织上的学问。<!--more -->

## 前提

首先我们需要思考的composition api和普通的函数有什么区别。区别在于在composition api中可以是响应式，所谓的响应式，最主要的特征是“变”，是变量的值跟着变；还是你修改变量的值，别的地方会跟着变。这是不同的思路。

## 常见的模式

### 状态 + 事件

通过全局状态或者一些全局api 获取到初始状态（当然也有可能是通过函数参数将初始状态传入），根据初始状态创建 `Ref`, 然后通过事件监听状态的变化，在状态变化时修改 `Ref` 的值。如果要将 响应式状态返回的话，还需要监听 响应式状态值的变化，变化之后，将值写到全局状态。

#### 固定参数，结果是浏览器依据环境变化的

也就是说往往是可读不可写的（readonly），那有人就要问了，不可写你直接读取它不就行了，为啥还需要响应式呢？原因在于这种状态虽然不可写，但是由于外界环境的变化，会自动发生变化。比如 `useMediaQuery`的结果就和显示区域大小有关。

比如`useMediaQuery` 就是利用了[matchMedia](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/matchMedia) api 实现了从全局获取数据，以及监听变化的功能。

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

使用时

```typescript
const isLargeScreen = useMediaQuery('(min-width: 1024px)')
```

除了 `useMediaQuery`, 还有许多

|                       | 初始值                                 | 事件                                                         |
| --------------------- | -------------------------------------- | ------------------------------------------------------------ |
| useMediaQuery         | window.matchMedia                      | window的blur和focus事件                                      |
| useBattery            | navigator.getBattery()                 | Battery 的 'chargingchange', 'chargingtimechange', 'dischargingtimechange' |
| usePermission         | navigator.permissions                  | navigator.permissions 返回的status 的change事件              |
| usePerferredLanguages | navigator.languages                    | Window的 languagechange事件                                  |
| useDeviceMotion       | 无                                     | Window 的 devicemotion事件                                   |
| useDeviceOrientation  | 无                                     | window的 deviceorientation事件                               |
| useDocumentVisibility | Document.visiblityState                | Document 的 visibilitychange事件                             |
| useElementBounding    | 无                                     | ResizeObserver                                               |
| useResizeObserver     | 无                                     | Window.ResizeObserver 回调                                   |
| useGeolocation        | 无                                     | Navigator.geolocation.watchPosition 回调                     |
| useMouse              | 无                                     | window的mouse move                                           |
| useMutationObserver   | 无                                     | window.MutationObserver的回调                                |
| useNetwork            | Navigator.connection                   | window的offline,online事件，connection的change事件           |
| useWindowScroll       | window.pageXOffest, window.pageYOffset | Window 的scroll事件                                          |

`useResizeObserver` 使用 `window.ResizeObserver`的回调更新值，也可以做到响应式

```typescript
function useResizeObserver(
  target: MaybeElementRef,
  callback: ResizeObserverCallback,
  options: ResizeObserverOptions = {},
) {
  const { window = defaultWindow, ...observerOptions } = options
  let observer: ResizeObserver | undefined
  const isSupported = window && 'ResizeObserver' in window

  const cleanup = () => {
    if (observer) {
      observer.disconnect()
      observer = undefined
    }
  }

  const stopWatch = watch(
    () => unrefElement(target),
    (el) => {
      cleanup()

      if (isSupported && window && el) {
        // @ts-expect-error missing type
        observer = new window.ResizeObserver(callback)
        observer!.observe(el, observerOptions)
      }
    },
    { immediate: true, flush: 'post' },
  )

  const stop = () => {
    cleanup()
    stopWatch()
  }

  tryOnUnmounted(stop)

  return {
    isSupported,
    stop,
  }
}
```

这里的 `isSupported`是普通变量，因为这种不会变化。

#### 变化的参数

浏览器不会无故变化，由外部控制变化。从实现方式上来看，可以通过 watch函数参数来监听外部变化。此处以 `useFavicon`为例。

```typescript
/**
 * Reactive favicon.
 *
 * @link https://vueuse.org/useFavicon
 * @param newIcon
 * @param options
 */
export function useFavicon(
  newIcon: MaybeRef<string | null | undefined> = null,
  options: FaviconOptions = {},
) {
  const {
    baseUrl = '',
    rel = 'icon',
    document = defaultDocument,
  } = options

  const favicon = isRef(newIcon)
    ? newIcon
    : ref<string | null>(newIcon)

  const applyIcon = (icon: string) => {
    document?.head
      .querySelectorAll<HTMLLinkElement>(`link[rel*="${rel}"]`)
      .forEach(el => el.href = `${baseUrl}${icon}`)
  }

  watch(
    favicon,
    (i, o) => {
      if (isString(i) && i !== o)
        applyIcon(i)
    },
    { immediate: true },
  )

  return favicon
}
```

除了 `useFavicon`之外，还有 `useTitle`, `useCssVar` 也是同样的思路。

#### 返回响应式的状态与方法

有些情况，我们需要修改状态，但是又不能简单使用第二种方式。比如 `useClipboard`, `useFullscreen`。这里以`useFullscreen` 为例，他可以控制将某个元素设置为全屏模式

```typescript
const el = ref<HTMLElement | null>(null)

const { isFullscreen, enter, exit, toggle } = useFullscreen(el)
```

实现上

```typescript
type FunctionMap = [
  'requestFullscreen',
  'exitFullscreen',
  'fullscreenElement',
  'fullscreenEnabled',
  'fullscreenchange',
  'fullscreenerror',
]

// from: https://github.com/sindresorhus/screenfull.js/blob/master/src/screenfull.js
const functionsMap: FunctionMap[] = [
  [
    'requestFullscreen',
    'exitFullscreen',
    'fullscreenElement',
    'fullscreenEnabled',
    'fullscreenchange',
    'fullscreenerror',
  ],
  // New WebKit
  [
    'webkitRequestFullscreen',
    'webkitExitFullscreen',
    'webkitFullscreenElement',
    'webkitFullscreenEnabled',
    'webkitfullscreenchange',
    'webkitfullscreenerror',
  ],
  // Old WebKit
  [
    'webkitRequestFullScreen',
    'webkitCancelFullScreen',
    'webkitCurrentFullScreenElement',
    'webkitCancelFullScreen',
    'webkitfullscreenchange',
    'webkitfullscreenerror',
  ],
  [
    'mozRequestFullScreen',
    'mozCancelFullScreen',
    'mozFullScreenElement',
    'mozFullScreenEnabled',
    'mozfullscreenchange',
    'mozfullscreenerror',
  ],
  [
    'msRequestFullscreen',
    'msExitFullscreen',
    'msFullscreenElement',
    'msFullscreenEnabled',
    'MSFullscreenChange',
    'MSFullscreenError',
  ],
] as any

/**
 * Reactive Fullscreen API.
 *
 * @link https://vueuse.org/useFullscreen
 * @param target
 * @param options
 */
export function useFullscreen(
  target?: MaybeElementRef,
  options: ConfigurableDocument = {},
) {
  const { document = defaultDocument } = options
  const targetRef = ref(target || document?.querySelector('html'))
  const isFullscreen = ref(false)
  let isSupported = false

  let map: FunctionMap = functionsMap[0]

  if (!document) {
    isSupported = false
  }
  else {
    for (const m of functionsMap) {
      if (m[1] in document) {
        map = m
        isSupported = true
        break
      }
    }
  }

  const [REQUEST, EXIT, ELEMENT,, EVENT] = map

  async function exit() {
    if (!isSupported)
      return
    if (document?.[ELEMENT])
      await document[EXIT]()

    isFullscreen.value = false
  }

  async function enter() {
    if (!isSupported)
      return

    await exit()

    if (targetRef.value) {
      await targetRef.value[REQUEST]()
      isFullscreen.value = true
    }
  }

  async function toggle() {
    if (isFullscreen.value)
      await exit()
    else
      await enter()
  }

  if (document) {
    useEventListener(document, EVENT, () => {
      isFullscreen.value = !!document?.[ELEMENT]
    }, false)
  }

  return {
    isSupported,
    isFullscreen,
    enter,
    exit,
    toggle,
  }
}

```

可以看到返回了当前的状态，以及用来控制状态的方法。其实这种场景如果使用返回响应式变量，通过修改响应式变量的方式也可以实现 "部分功能"，比如`isFullscreen.value = false` 就将改元素退出全屏。也不是不可以，只不过这里 使用`enter`, `exit`, `toggle` 语义功能上来说会更加完整，而且，函数还可以传递参数（比如useClipboard)。还有`useScriptTag`，`useShare` 也是类似的思路。

可以看下 `useShare` 是一个典型的例子，需要返回函数用来传递参数

```typescript
const { share, isSupported } = useShare()

function startShare() {
  share({
    title: 'Hello',
    text: 'Hello my friend!',
    url: location.href,
  })
}
```

或者

```typescript
const shareOptions = ref<ShareOptions>({ text: 'foo' })
const { share, isSupported } = useShare(shareOptions)

shareOptions.value.text = 'bar'

share()
```

可以接收一个参数是一个配置对象。也可以直接往 `share`里传配置对象

```typescript
export function useShare(shareOptions: MaybeRef<ShareOptions> = {}, options: ConfigurableNavigator = {}) {
  const { navigator = defaultNavigator } = options

  const _navigator = (navigator as NavigatorWithShare)
  const isSupported = _navigator && 'canShare' in _navigator

  const share = async(overrideOptions: MaybeRef<ShareOptions> = {}) => {
    if (isSupported) {
      const data = {
        ...unref(shareOptions),
        ...unref(overrideOptions),
      }
      let granted = true

      if (data.files && _navigator.canShare)
        granted = _navigator.canShare({ files: data.files })

      if (granted)
        return _navigator.share!(data)
    }
  }

  return {
    isSupported,
    share,
  }
}
```



#### 监听事件

可以将 , domRef传入composition api中，达到事件监听。比如 `onClickOutisde`, `onKeyStroke`, `onStartTyping`

```typescript
const events = ['mousedown', 'touchstart', 'pointerdown'] as const
type EventType = WindowEventMap[(typeof events)[number]]

/**
 * Listen for clicks outside of an element.
 *
 * @link https://vueuse.org/onClickOutside
 * @param target
 * @param handler
 * @param options
 */
export function onClickOutside(
  target: MaybeElementRef,
  handler: (evt: EventType) => void,
  options: ConfigurableWindow = {},
) {
  const { window = defaultWindow } = options

  if (!window)
    return

  const listener = (event: EventType) => {
    const el = unrefElement(target)
    if (!el)
      return

    if (el === event.target || event.composedPath().includes(el))
      return

    handler(event)
  }

  let disposables: Fn[] = events
    .map(event => useEventListener(window, event, listener, { passive: true }))

  const stop = () => {
    disposables.forEach(stop => stop())
    disposables = []
  }

  tryOnUnmounted(stop)

  return stop
}
```

onStartTyping

```typescript
const isFocusedElementEditable = () => {
  const { activeElement, body } = document

  if (!activeElement)
    return false

  // If not element has focus, we assume it is not editable, too.
  if (activeElement === body)
    return false

  // Assume <input> and <textarea> elements are editable.
  switch (activeElement.tagName) {
    case 'INPUT':
    case 'TEXTAREA':
      return true
  }

  // Check if any other focused element id editable.
  return activeElement.hasAttribute('contenteditable')
}

const isTypedCharValid = ({
  keyCode,
  metaKey,
  ctrlKey,
  altKey,
}: KeyboardEvent) => {
  if (metaKey || ctrlKey || altKey)
    return false

  // 0...9
  if ((keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105))
    return true

  // a...z
  if (keyCode >= 65 && keyCode <= 90)
    return true

  // All other keys.
  return false
}

/**
 * Fires when users start typing on non-editable elements.
 *
 * @link https://vueuse.org/onStartTyping
 * @param callback
 * @param options
 */
export function onStartTyping(callback: (event: KeyboardEvent) => void, options: ConfigurableDocument = {}) {
  const { document = defaultDocument } = options

  const keydown = (event: KeyboardEvent) => {
    !isFocusedElementEditable()
      && isTypedCharValid(event)
      && callback(event)
  }

  if (document)
    useEventListener(document, 'keydown', keydown, { passive: true })
}
```

原理都一样，监听事件，调用回调。只不过是使用composition api的方式来实现

#### 回调

vueuse 中还有一些 `useRafFn`, `useTimeoutFn`, `useIntervalFn` 这类函数。

```typescript
export function useRafFn(fn: Fn, options: RafFnOptions = {}): RafFnReturn {
  const {
    immediate = true,
    window = defaultWindow,
  } = options

  const isActive = ref(false)

  function loop() {
    if (!isActive.value)
      return
    fn()
    if (window)
      window.requestAnimationFrame(loop)
  }

  function resume() {
    if (!isActive.value) {
      isActive.value = true
      loop()
    }
  }

  function pause() {
    isActive.value = false
  }

  if (immediate)
    resume()

  tryOnUnmounted(pause)

  return {
    isActive,
    pause,
    resume,
    stop: pause,
    start: resume,
  }
}
```



## 其他有意思的实现

 `usePageLeave`

```typescript
export function usePageLeave(options: ConfigurableWindow = {}) {
  const { window = defaultWindow } = options
  const isLeft = ref(false)

  const handler = (event: MouseEvent) => {
    if (!window)
      return

    event = event || (window.event as any)
    // @ts-ignore
    const from = event.relatedTarget || event.toElement
    isLeft.value = !from
  }

  if (window) {
    useEventListener(window, 'mouseout', handler, { passive: true })
    useEventListener(window.document, 'mouseleave', handler, { passive: true })
    useEventListener(window.document, 'mouseenter', handler, { passive: true })
  }

  return isLeft
}
```

视差滚动`useParallax`

```typescript
export function useParallax(
  target: MaybeElementRef,
  options: ParallaxOptions = {},
): ParallaxReturn {
  const {
    deviceOrientationTiltAdjust = i => i,
    deviceOrientationRollAdjust = i => i,
    mouseTiltAdjust = i => i,
    mouseRollAdjust = i => i,
    window = defaultWindow,
  } = options

  const orientation = reactive(useDeviceOrientation({ window }))
  const {
    elementX: x,
    elementY: y,
    elementWidth: width,
    elementHeight: height,
  } = useMouseInElement(target, { handleOutside: false, window })

  const source = computed(() => {
    if (orientation.isSupported
      && ((orientation.alpha != null && orientation.alpha !== 0) || (orientation.gamma != null && orientation.gamma !== 0))
    )
      return 'deviceOrientation'
    return 'mouse'
  })

  const roll = computed(() => {
    if (source.value === 'deviceOrientation') {
      const value = -orientation.beta! / 90
      return deviceOrientationRollAdjust(value)
    }
    else {
      const value = -(y.value - height.value / 2) / height.value
      return mouseRollAdjust(value)
    }
  })

  const tilt = computed(() => {
    if (source.value === 'deviceOrientation') {
      const value = orientation.gamma! / 90
      return deviceOrientationTiltAdjust(value)
    }
    else {
      const value = (x.value - width.value / 2) / width.value
      return mouseTiltAdjust(value)
    }
  })

  return { roll, tilt, source }
}
```

templateRef 的实现也很有意思，它的用法是不需要返回ref，直接绑定dom

```html
template>
  <div ref="target"></div>
</template>

<script lang="ts">
import { templateRef } from '@vueuse/core'

export default {
  setup() {
    const target = templateRef('target')

    // no need to return the `target`, it will bind to the ref magically
  }
}
</script>
```



```typescript
/**
 * Shorthand for binding ref to template element.
 *
 * @link https://vueuse.org/templateRef
 * @param key
 * @param initialValue
 */
export function templateRef<T extends Element | null>(
  key: string,
  initialValue: T | null = null,
): Readonly<Ref<T>> {
  const instance = getCurrentInstance()
  let _trigger = () => {}

  const element = customRef((track, trigger) => {
    _trigger = trigger
    return {
      get() {
        track()
        return instance?.proxy?.$refs[key] ?? initialValue
      },
      set() {},
    }
  })

  onMounted(_trigger)
  onUpdated(_trigger)

  return element as Readonly<Ref<T>>
}
```

利用自定义Ref在 get的时候返回instance的 ref，然后在 渲染完成之后手动调用 trigger 触发更新，依赖于这个ref的变量将会重新取值。
