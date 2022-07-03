---
title: Vue中的scope slot和render函数
date: 2020-07-05 09:49:48
description: 掌握scope slot和render函数，迈向自由编程
---

在Vue中使用slot-scope和render函数都可以做到自定义渲染，其实二者有很多相通之处，本文将通过几个例子来分析slot-scope和render 的灵活应用。<!-- more -->

## 代码背景

本文一个需要实现自定义表格，每列的内容都希望可以自定义渲染，在业务组件business.vue中通过column传给给Grid组件一些配置，就可以实现自定义渲染。

为了文章篇幅，本文代码均为精简代码，只是为了演示最核心的内容。

## 实现方案

### render 函数

```js
// Render.js
export default {
  functional: true,
  props: {
    row: Object,
    column: Object,
    rowIndx: Number,
    columnIndx: Number,
    render: Function
  },
  render(h, ctx) {
    const params = {
      row: ctx.props.row,
      column: ctx.props.column,
      rowIndex: ctx.props.rowIndex,
      columnIndex: ctx.props.columnIndx
    }
    return ctx.props.render(h, params)
  }
}
```

Grid组件columns prop中可以接收render函数，将rende函数r传递给render组件。

```html
<!-- Grid.vue -->
<template>
<div>
  <tbody>
    <tr v-for="(row, rowIndex) in data">
      <td v-for="(col, colIndex) in columns">
        <template v-if="'render' in col">
          <Render :render="col.render" :row="row" :column="col" :rowIndex="rowIndex" :columnIndex="colIndex" />
        </template>
      </td>
    </tr>
  </tbody>
</div>
</template>
```

在使用的时候配置render项

```html
<template>
	<div>
    <Grid :columns="columns" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      columns: [
        {
          title: 'name',
          render: (h, { row, column, rowIndex, columnIndex }) =>
            h('span', `${rowIndex}: ${row.name}`)
        }
      ]
    }
  }
}
</script>
```

### slot-scope

在组件内支持配置slot，如果slot有值的话，则使用slot渲染

```html
<!-- Grid.vue -->
<template>
<div>
  <tbody>
    <tr v-for="(row, rowIndex) in data">
      <td v-for="(col, colIndex) in columns">
        <template v-if="'slot' in col">
          <slot :name="col.slot" :row="row" :column="col" :rowIndex="rowIndex" :columnIndex="colIndex" />
        </template>
      </td>
    </tr>
  </tbody>
</div>
</template>
```

在使用Grid组件的时候，通过slot选项实现自定义渲染

```html
<!-- business.vue -->
<template>
	<div>
    <Grid :colomn="columns">
    	<template v-slot:name="{ row }">
        <input type="text" v-model="editName" />
        <span v-else>{{ row.name }}</span>
      </template>

      <template v-slot:age="{ row }">
        <input type="text" v-model="editAge" />
        <span v-else>{{ row.age }}</span>
      </template>
    </Grid>
  </div>
</template>

<script>
export default {
  data() {
    return {
      columns: [
        {
          text: 'name',
          slot: 'name'
        },
        {
          text: age,
          slot: 'age'
        }
      ]
    }
  }
}
</script>
```

### slot -> render 使用上转化

有得时候Grid组件并不支持slot选项，仅仅支持render函数，但是我们又想通过scope-slot的方式来使用。

```html
<!-- Grid.vue -->
<template>
  <div>
    <tbody>
      <tr v-for="(row, rowIndex) in data">
        <td v-for="(col, colIndex) in columns">
          <template v-if="'render' in col">
            <Render :render="col.render" :row="row" :column="col" :rowIndex="rowIndex" :columnIndex="colIndex" />
          </template>
        </td>
      </tr>
    </tbody>
  </div>
</template>
```

可以在使用Grid组件的时候将插槽转换为render函数。

```html
<!-- business.vue -->
<template>
<div>
  <Grid :colomn="columns" ref="grid">
    <template v-slot:name="{ row }">
      <input type="text" v-model="editName" />
      <span v-else>{{ row.name }}</span>
    </template>

    <template v-slot:age="{ row, index }">
      <input type="text" v-model="editAge" />
      <span v-else>{{ row.age }}</span>
    </template>
  </Grid>
</div>
</template>

<script>
export default {
  data() {
    return {
      columns: [
        {
          text: 'name',
          render: (h, { row, column, rowIndex, columnIndex} ) => {
            return this.$refs.grid.$scopeSlots.name({
              row,
              column,
              rowIndex.
              columnIndex
            })
          }
        },
        {
          text: 'age',
          render: (h, { row, column, rowIndex, columnIndex} ) => {
            return this.$refs.grid.$scopeSlots.name({
              row,
              column,
              rowIndex.
              columnIndex
            })
          }
        }
      ]
    }
  }
}
</script>
```

这里将Grid组件的scope-slots通过组件实例的$scopeSlots选项取到（本质上是一个函数），然后在business中的render函数中返回调用结果，尽管Grid组件不支持插槽，但是我们在使用Grid的时候，可以在模板中写插槽（仅仅写是不会生效的），然后将插槽转化为render函数。

### slot-> render组件中转化

其实，组件内部支持scope-slot不仅仅可以通过slot标签来实现，还可以用下面这种方式来实现

```js
// SlotRender.js
export default {
  functional: true,
  inject: ['Grid'],
  props: {
    row: Object,
    column: Object,
    rowIndex: Number,
    columnIndex: Number
  },
  render: (h, ctx) =>
  	return h('div', ctx.injection.Grid.$scopeSlots[ctx.props.column.slot]({
          row: ctx.props.row,
          column: ctx.props.column,
      		rowIndex: ctx.props.rowIndex,
      		columnIndex: ctx.props.columnIndex
        }))
}
```



```html
<!-- Grid.vue -->
<template>
  <div>
    <tbody>
      <tr v-for="(row, rowIndex) in data">
        <td v-for="(col, colIndex) in columns">
          <template v-if="'slot' in col">
            <SlotRender :row="row" :column="col" :rowIndex="rowIndex" :columnIndex="colIndex" />
          </template>
        </td>
      </tr>
    </tbody>
  </div>
</template>

<script>
export default {
  provide() {
    return {
      Grid: this
    }
  }
}
</script>
```



在使用上，仍然可以通过插槽

```html
<!-- business.vue -->
<<template>
<div>
  <Grid :colomn="columns" ref="grid">
    <template v-slot:name="{ row }">
      <input type="text" v-model="editName" />
      <span v-else>{{ row.name }}</span>
    </template>

    <template v-slot:age="{ row }">
      <input type="text" v-model="editAge" />
      <span v-else>{{ row.age }}</span>
    </template>
  </Grid>
</div>
</template>

<script>
export default {
  data() {
    return {
      columns: [
        {
          text: 'name',
          slot: 'name'
        },
        {
          text: 'age',
          slot: 'age'
        }
      ]
    }
  }
}
</script>
```

这里要注意的是，$scopeSlots只能在组件实例上能够取到，所以上面的两个例子中，在上层组件获取Grid实例的方式是通过ref的方式，在Grid子组件中获取Grid实例的方式是通过provide/inject。

以上就是scopeSlots 和 render函数，其实最主要的是render函数和slot方式，另外两种方式能够更好地帮助你理解作用域插槽和render函数。



## 补充

强烈看看[vue-promised](https://github.com/posva/vue-promised)源码来学习scoped-slots和render函数的妙用。
