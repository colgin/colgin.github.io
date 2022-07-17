---
title: 如何处理ts中不可靠的类型
date: 2022-07-17 11:44:00
description: 从接口获取的数据类型应该怎么定义？
---


在ts中经常会遇到一些未知的无法控制的类型，比如说从一个接口中获取数据的时候，返回的数据类型是没法控制的。比如如下代码

```ts
fetch('/somthing')
	.then(res => res.json())
	.then(result => {
		// result type here is any
	})
```

result 现在是 any 类型，这就导致了在 then 函数中所有的代码都失去了类型保护。那有没有什么办法可以解决这种问题呢

## 直接指定

如上诉代码所示，既然result 是 any 类型，那么我们给他指定一个类型不就行了
```ts
interface DataFromApi {
	name: string
	id: string
}

fetch('/something')
	.then(res => res.json())
	.then((result: DataFromApi) => {
		// result type here is DataFromApi
	})
```

通过这种方式可以给result 变量加上类型。如果你觉得这种方式不够优雅，你还可以封装一个 请求方法，将类型通过 泛型传递过去。

```ts
function myFetch<Response>(url) {
	return fetch(url).then((res) => res.json() as Response)
}

interface DataFromApi {
	name: string
	id: string
}

myFetch<DataFromApi>('/something')
	.then(result => {
		// result type here is DataFromApi
		console.log(result.name.split(','))
	})
```

有的读者会有疑问，接口来的数据经常变化，那我是不是每次接口一变，就要去把接口类型改了和实际接口数据完全对齐呢？笔者认为，这是没有必要的，因为ts的类型只是编译时的约束，表达的是你期望他是什么类型，只有符合这个结构的数据才能让你的代码畅通无阻，所以这里的类型其实只要定义业务中需要的字段就可以了，没有必要完全对着接口真正的返回值来定义。

前面说到这种方式的类型完全是编译时的类型，即使代码编译、类型检查没有错误，实际运行的时候也不一定没有错误，比如万一接口返回的数据没有name字段，业务代码就会报错，也就是说这种方式是没有运行时保护的

## 使用zod

[zod](https://github.com/colinhacks/zod) 是一个 ts-first 的 schema 验证器，用zod来实现上面的功能。

```ts
import { z } from 'zod'

const Data = z.object({
	id: z.string(),
	name: z.string()
})

type DataType = z.infer<typeof Data>

fetch('/something')
	.then(res => res.json())
	.then(result => {
		// now data is typed
		const data = Data.parse(result)
	})
```

可以看到我们定义了一个 返回结构的schema叫Data，在拿到接口返回的数据result 之后，我们使用 `Data.parse(result)` 就可以得到一个有 类型的 data 变量，任何不符合 schema 的 result 都会在parse时抛错，这就给代码加上了运行时的保护了，只有符合结构的的返回值才会执行后续的代码。

这里笔者把zood实现的逻辑用ts简易的实现了一遍，主要是类型定义的部分

```ts
namespace zood {
	type TZoodString = 'ZoodString'
	type TZoodNumber = 'ZoodNumber'
	type TZoodBoolean = 'ZoodBoolean'
	
	interface ZoodSchema {
		type: any
	}

	interface IZoodString extends ZoodSchema {
		type: TZoodString
		length?: number
		rule?: RegExp
	}

	interface IZoodNumber extends ZoodSchema {
		type: TZoodNumber
		min?: number
		max?: number	
	}

	interface IZoodBoolean extends ZoodSchema {
		type: TZoodBoolean
		not?: boolean
	}

	type TZoodTypeMap = {
		ZoodString: string
		ZoodNumber: number
		ZoodBoolean: boolean
	}
	
	type SchemaType<Schema extends ZoodSchema> = Schema[`type`] extends keyof TZoodTypeMap ? TZoodTypeMap[Schema[`type`]] : Schema[`type`]

	export function string(): IZoodString{
		return {
			type: 'ZoodString',
		}
	}

	export function number(): IZoodNumber{
		return {
			type: 'ZoodNumber'
		}
	}

	export function boolean(): IZoodBoolean {
		return {
			type: 'ZoodBoolean'
		}
	}

	type ZoodLeteralType = number | boolean | string | undefined | null

	export function literal<T extends ZoodLeteralType>(val: T) {
		return {
			type: val
		} as {
			type: T
		}
	}

	export function object<T extends Record<string, any>>(o: T){
		return {
			parse: (val: any) => {
				// do some check, throw error if not match
				// 1. check keys
				// 2. check types
				// 3. and so on
				const finalVal = val as Record<keyof T, any>
				return finalVal as {
					[k in keyof T]: SchemaType<T[k]>
				}
			}
		}
	}

	export type infer<Schema> = Schema extends { parse: (...vals: any) => infer T } ? T : never
}

const formSchema = zood.object({
	a: zood.number(),
	b: zood.string(),
	c: zood.boolean(),
	z: zood.literal(null)
})

// now parsedData is { a: number, b: string, c: boolean, z: null }
const parseData = formSchema.parse({
	a: 4,
	b: 'hell',
	c: false,
	z: null
})

// { a: number, b: string, c: boolean, z: null }
type DataType = zood.infer<typeof formSchema>
```

不过需要注意的是，这里笔者没有支持链式调用，如果要支持的话， 将`zood.string`作为一个工厂函数返回一个实例就可以了。

### 参考

- [TypeScript tips and tricks with matt](https://www.youtube.com/watch?v=hBk4nV7q6-w)
