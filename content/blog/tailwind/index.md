---
title: 谈tailwindcss
date: 2022-09-12
description: 体验了tailwind，我想说这些...
---

[tailwind](https://tailwindcss.com/) 无疑是近几年非常热门的技术了，原子化css的设计理念也深的众多开发者喜爱，根据 [state of css 2021](https://2021.stateofcss.com/en-US/technologies/css-frameworks) 统计，tailwind 在用户满意度和使用兴趣上位居榜首，在使用率上仅次于 bootstrap，位居第二，可以说是 css 框架的当红炸子鸡了。

在将 tailwind 引入到实际大型项目中一段时间之后，tailwind 也确实如其描述地那样带来了巨大的开发体验提升，当然也有一些令人困惑的问题，本文将先一一介绍。

## 开发体验提升在何处

### 不用纠结命名问题

[原子化css]() 通过直接使用 utility class 的方式让我们面去自己给 class 命名的问题

```html
<div class="card"></div>

<style>
  .card {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    border-radius: 0.5rem;
  }

</style>
```

可以直接使用 utility class
```html
<div class="flex justify-center items-center p-4 rounded"></div>
```

我们再也不需要纠结要给 class 命什么名了，跟BEM说byebye。不过缺点是html会变得大一些。

### 样式覆盖与优先级

如果css是

```css
.bg-bg-red {
  background: red;
}
.btn {
  background: gray;
}
```

```html
<div class="btn btn-bg-red"></div>
<div class="btn-bg-red btn"></div>
```
其实背景都是 `gray`, 因为后声明的 style 会覆盖前面的，这就给样式带来了不确定性。然而这就和 html 表达出来的不一样了。tailwind 引入了 `layer` 这个概念来解决这种问题，且提供了三个内置的layer，他们是有优先级的

- base: 一般用来做一些默认样式或者初始化
- components: 组件维度，比 base 优先级高，但是可以被utitlities layer覆盖
- utilities: 原子/工具 类，优先级最高


比如 有一个 components class

```css
.btn {
  background: theme(colors.red.500);
}
```

而 `bg-red-600` 是一个 utilities class

```css
.bg-red-600 {
  background: theme(colors.red.600)
}
```

那么无论以下哪种方式，其最终结果，背景都是 `colors.red.600`

```html
<div class="btn bg-red-600"></div>
<div class="bg-red-600 btn"></div>
```

> 注 css-in-js 也同样要解决这一个问题，不过 css-in-js 是看 class 中哪个class在后面，比如 `class="btn bg-red-600"` 颜色就是 `bg-red-600` 的颜色, `class="bg-red-600 btn"` 颜色就是 btn 的颜色


### css体积增长收敛

日常项目中，随着项目的复杂度越来越高，会定义越来越多的class，因此css 体积会变得越来越大。导致这种现象的原因是css 的复用率很低。而 tailwind 这类原子化css 方案，每个class 一般只对应了一个css规则，通过组合的方式来修饰网页中的元素，虽然一开始的体积会大一些，但是随着项目的日益复杂，大部分的css 都可以得到复用，加上 tailwind v3 引入了 JIT 引擎，只会将使用到的class生成最终的css文件。比如 [netflix top 10](https://top10.netflix.com/) 整个网页的css文件只有7kb左右。

### 很好地与设计系统结合

通过 `tailwind.config.js` 文件，可以定义每个 utility class对应的值。典型的，比如可以配置不同的颜色，不同的距离，不同的阴影。这对于一个有完备设计系统的公司可以大大提升项目的复用性，降低迁移难度。

### dark mode，media query的支持

现在很多网页都需要支持 dark mode，tailwind 也提供了[两种开箱即用的 dark mode 支持](https://tailwindcss.com/docs/dark-mode)， 跟随系统（使用media query）以及 html class的方式，可以在 `tailwind.config.js` 中配置。

而使用的时候，就更简单了，通过 `dark:` 即可添加 dark mode 的支持

```html
<div class="bg-white dark:bg-black"></div>
```

上面这一段在正常模式下是白色背景，在暗黑模式下是黑色背景。

### 生态与插件

tailwind 本身是一个 postcss 插件，而 tailwind 也提供了插件化的支持，通过插件，可以给tailwind 添加更多的预设。比如为 tailwind 增加一些新的 utility class，或者增加一些 component class。使得使用者无需重复写的 class。


## JIT

tailwind v3 引入了 Just-in-Time engine(JIT), 会根据使用情况按需生成 style。不过 tailwind 的jit做的比较简单，不会做任何的转化，执行。其实就是普通的文本查找的过程。这就要求，class 名字要给完整

```jsx
<Text color="purple" size="lg">I should be purple and large text.</Text>


// Component implementation
export function Text({color, size, children}) {
  return (
		<p className={`text-${color}-700 text-${size} ...`}>
			{children}
		<p>
	)
}
```

比如这样的，tailwind JIT 是识别不出来使用到了哪些 class。为了达到目的，可以

```jsx
const variantsLookup = {
  primary: 'bg-cyan-500 text-white shadow-lg ...',
  secondary: 'bg-slate-200 text-slate-800 shadow ...',
  danger: 'bg-red-500 text-white shadow-lg ...',
  text: 'text-slate-700 uppercase underline ...',
}

const sizesLookup = {
  small: 'px-3 py-1.5 text-sm ...',
  medium: 'px-5 py-3 ...',
  large: 'px-8 py-4 text-lg ...',
}

// Component use
<Button variant="primary" size="lg">I should be purple and large text.</Text>

// Component implementation
export function Text({variant, size, children, ...rest}) {
  return (
		<button {...rest} className={`${variantsLooksup[color]} ${sizesLookup[size]}`}>
			{children}
		</button>
	)
}

Button.defaultProps = {
  variant: 'primary',
  size: 'medium',
}
```

前面我们说到，JIT engine 做的事情很简单，就是单纯地去扫描目标文件夹里的问题，看看有没有 预定义好的 class，如果有，就会生成 style

```html
<div>
  bg-red-500
</div>
```
也同样会在css文件中生成 `.bg-red-500` 这条规则。

## tailwind的问题

tailwind 是一个非常成熟的，也非常优秀的解决方案，但是个人在一段时间的使用之后，也遇到了一些困扰，不能说是tailwind 的问题，仅仅是个人的一些不便之处

### 冗长的class

在 tailwind 中，极力推荐尽可能直接使用 utility class，不建议过度依赖自定义class名，然后使用`apply` 引用 tailwind 的这种形式。

```html
<!-- Even with custom CSS, you still need to duplicate this HTML structure -->
<div class="chat-notification">
  <div class="chat-notification-logo-wrapper">
    <img class="chat-notification-logo" src="/img/logo.svg" alt="ChitChat Logo">
  </div>
  <div class="chat-notification-content">
    <h4 class="chat-notification-title">ChitChat</h4>
    <p class="chat-notification-message">You have a new message!</p>
  </div>
</div>

<style>
  .chat-notification { /* ... */ }
  .chat-notification-logo-wrapper { /* ... */ }
  .chat-notification-logo { /* ... */ }
  .chat-notification-content { /* ... */ }
  .chat-notification-title { /* ... */ }
  .chat-notification-message { /* ... */ }
</style>
```

推荐直接使用 utility class

```jsx
function Notification({ imageUrl, imageAlt, title, message }) {
  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md flex items-center space-x-4">
      <div className="shrink-0">
        <img className="h-12 w-12" src={imageUrl} alt={imageAlt}>
      </div>
      <div>
        <div className="text-xl font-medium text-black">{title}</div>
        <p className="text-slate-500">{message}</p>
      </div>
    </div>
  )
}
```

于是会经常看到class是很长一串，比如

```html
<button
  class="w-full sm:w-auto text-lg uppercase text-gray-100 bg-purple-800 hover:bg-purple-700 focus:bg-purple-700 focus-visible:ring-4 ring-purple-400 px-6 py-2 rounded-full transition-colors duration-300"
>
  Click Me
</button>
```
这么长的class名字大大提高了理解难度，可以给不同的 class 分类，

```html
<button
  class="w(full sm:auto) text(lg uppercase gray-100) bg-purple(800 700(hover:& focus:&)) ring(purple-400 focus-visible:4)) px-6 py-2 rounded-full transition-colors duration-300"
>
  Click Me
</button>
```

通过这种方式，根据功能将class分类，可以降低维护成本。[twind](https://twind.dev/handbook/grouping-syntax.html#thinking-in-groups) 和 [windicss](https://windicss.org/features/#variant-groups) 都支持这种方式。tailwind 相关的功能已经开发好了 [Experimental support for variant grouping](https://github.com/tailwindlabs/tailwindcss/pull/8405)，但是目前只能在 insiders build （内测？）中通过配置开关才能将这个功能打开。

### 主题颜色的命名

在写样式的时候，你是否会经常纠结，这个背景是应该 用 `bg-gray-100`, 还是 使用 `bg-gray-300`呢？相信对于一些不需要精准还原的页面来说，这是一件非常痛苦的事情，因为你永远只知道 `bg-gray-100` 比 `bg-gray-300` 颜色要谈，但是淡多少以及和其他颜色的搭配如何，完全没有概念，这就导致了每次一个元素的样式，你都要先纠结背景，在纠结字体用哪个颜色，再纠结边框用哪个颜色，他们在一起会不会很唐突。 这就是 使用这种阶梯式的颜色空间的问题。

在个人的项目中，其实可以根据颜色的使用场景来区分，比如绿色，绿色可以有不同的状态，默认状态的绿色，hover时颜色变重对应一个绿色，disabled的时候对应一个绿色。借助于 `tailwind.config.js` 的 `extend`，可以对主题进行扩展

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        green: {
          base: 'xxx',
          active: 'yyy',
          disabled: 'zzz'
        }
      }
    }
  }
}
```

使用的时候，可以根据实际用途场景即可快速知道应该使用哪个 class

```html
<button class="bg-green-base hover:bg-green-active disabled:bg-green-disabled"></button>
```

## 直觉与反直觉

在 tailwind 中，默认配置下 `p-1`, `p-2`, `p-3`, `p-4` 对应的样式是 padding 为 `4px`, `8px`, `12px`, `16px`。虽然可以通过 tailwind.config.js 中去配置[spacing](https://tailwindcss.com/docs/theme#spacing)，但也不可能将所有的距离都定义出来。那为什么有 `4px`, `8px`, 没有 `7px`呢，那我要怎么实现一个 `padding: 7px`呢？在 tailwind v2是没有覆盖到的这种场景的（此处存疑？），因此你需要额外写一个 class。

```html
<button class="bg-red-400 button"></button>

<style>
  .button {
    padding: 7px;
  }
</style>
```

在 tailwind v3，对这种情况引入了 bracket notation 可以添加任意的css值

```html
<!--任意的css值-->
<div class="bg-[#dada55] text-[22px] before:content-['Festivus']"></div>

<!--任意的属性加值-->
<div class="[mask-type:luminance] bg-[url('/sample.png')]"></div>

<!--甚至还能定义css属性-->
<div class="[--scroll-offset:56px] lg:[--scroll-offset:44px]"></div>
```
更多使用请查看 [Using arbitrary values](https://tailwindcss.com/docs/adding-custom-styles#using-arbitrary-values)。通过这种方式，大大提升了 tailwind 的场景覆盖率。


## tailwind 生态

tailwind 提供了比较好的[插件api](https://tailwindcss.com/docs/plugins), 开发者可以给 tailwind 添加更多的 class preset，比如`addComponents()`可以注册静态的component styles，`addUtilities()`可以注册更多的utility style。

社区里比较著名的一个是 [daisyui](https://daisyui.com/), 提供了很多 component style。通过下面这样简单语句就可以写出非常漂亮的按钮了

```html
<button class="btn">Button</button>
<button class="btn btn-primary">Button</button>
<button class="btn btn-secondary">Button</button>
<button class="btn btn-accent">Button</button>
<button class="btn btn-ghost">Button</button>
<button class="btn btn-link">Button</button>
```

还有一个便是 [flowbite](https://flowbite.com/), flowbite 并没有提供 components style，而是提供了很多模板。

```html

<button type="button" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800">Default</button>

<button type="button" class="py-2.5 px-5 mr-2 mb-2 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Alternative</button>

<button type="button" class="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700">Dark</button>

<button type="button" class="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700">Light</button>

<button type="button" class="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">Green</button>

<button type="button" class="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900">Red</button>

<button type="button" class="focus:outline-none text-white bg-yellow-400 hover:bg-yellow-500 focus:ring-4 focus:ring-yellow-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:focus:ring-yellow-900">Yellow</button>

<button type="button" class="focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-sm px-5 py-2.5 mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900">Purple</button>
```

使用者直接复制就好了，和 daisyui只提供了静态css不一样的是， flowbite 还包含了一些用于交互的js代码。

比如 `Modal` 这个组件的交互通过css 就做不到，在 flowbite 中却可以这么写

```html

<!-- Modal toggle -->
<button class="block text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" type="button" data-modal-toggle="defaultModal">
  Toggle modal
</button>

<!-- Main modal -->
<div id="defaultModal" tabindex="-1" aria-hidden="true" class="hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 w-full md:inset-0 h-modal md:h-full justify-center items-center">
  <!---->
  <div>
    <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="defaultModal">
        <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
        <span class="sr-only">Close modal</span>
    </button>
  </div>

  <!-- Modal footer -->
  <div class="flex items-center p-6 space-x-2 rounded-b border-t border-gray-200 dark:border-gray-600">
      <button data-modal-toggle="defaultModal" type="button" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">I accept</button>
      <button data-modal-toggle="defaultModal" type="button" class="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600">Decline</button>
  </div>
</div>
```

在上面的例子中，点击按钮，就会弹出一个模态框，模态框里有关闭按钮，点击会关闭弹窗。可以看出flowbite不仅仅是提供了 UI  样式套件，还提供了交互的支持，这是怎么做到的呢？

原因是flowbite提供了一些 JavaScript， 这些js 代码会在 document 加载完成时，通过属性选择器找到各个需要绑定事件的dom元素，给它们加上事件处理函数，这样，不需要开发者只需要把结构写出来，然后，在合适的dom上加上属性，比如`data-modal-toggle="defaultModal"`，这样一个可以交互的组件就完成了。

可以看到，同样是tailwind 生态的组件，但是二者的思路完全不一样，但是他们都共同依赖 tailwind 提供的基础能力，自定义能力。


