---
title: Node中的内存控制
date: 2017-11-24 10:49:29
description: 介绍一下内存控制的算法机制
---

## V8

### V8的内存限制

在Node中通过JavaScript使用内存会发现只能使用部分内存（64位系统下约为1.4GB，32位系统下约为0.7GB）。这种限制下，会导致Node无法直接操作大内存对象。造成这种限制的主要原因在于Node基于V8构建，所以在Node中使用JavaScript对象都是通过V8自己的方式来进行分配和管理的。<!--more-->V8做这种限制的原因在于两点，其一，v8最初是设计给浏览器使用，浏览器上不大会遇到大内存的情况，所以限制值就足够使用了；其二，受限于V8的垃圾回收机制，按照官方说法，以1.5GB的垃圾回收堆内存为例，V8做一次小的垃圾回收需要50毫秒以上，做一次非增量式的垃圾回收甚至要1秒以上。这是垃圾回收中引起JavaScript线程暂停执行的事件，在这样的时间花销下，应用的性能和响应能力都会直线下降。这就限制了开发者随心所欲使用大内存的想法。如果超过了这个限制，可能会导致进程退出。

### v8的对象分配
在V8中，所有JavaScript对象都是通过堆来进行分配的，可以通过**process.memoryUsage()**来查看

### V8的垃圾回收机制

#### 内存分代

在V8中，把内存分为新生代和老生代两种，新生代中的对象为存活时间较短的对象，老生代中的对象为存活时间较长或常驻内存的对象。
从V8源码中可以看到，默认设置下，老生代内存在64位系统下为1400MB，在32位系统下为700MB。新生代内存由两个reserved_semispace_size_构成，reserved_semispace_size_在64位和32位系统下分别是16MB和8MB，所以新生代内存在64位和32位系统下分别为32MB和16MB。
V8堆内存的最大保留空间公式为：4*reserved_semispace_size_ + max_old_generation_size_。所以准确的说v8堆内存在64位和32位系统下的大小为1464MB和732MB

#### 内存回收算法

##### Scavenge算法：空间换时间，适用于新生代内存

采用Cheney算法，使用负值的方式实现的垃圾回收算法。它将堆内存一分为二，每一部分空间成为semispace。在这两个semispace空间中，只有一个处于使用中，另一个处于闲置状态。处于使用状态的semispace空间称为From空间，处于闲置状态的空间称为To空间。当我们分配对象时，先是在From空间中进行分配。当开始进行垃圾回收时，会检查From空间中的存活对象，这些存活对象将被赋值到To空间中，而非存活对象占用的空间将会被释放。完成复制后，From空间和To空间的角色发生对换。简而言之，在垃圾回收的过程中，就是通过将存活对象在两个semispace空间之间进行复制。（注意只复制存活的对象，由于新生代中对象生命周期比较短，所以这种算法有优异的表现）。
在一定条件下，需要将存活周期长的对象移动到老生代中去（对象晋升），条件如下（满足一个即可）

 - 对象是否经历过Scavenge回收
 - To空间的内存占用比例是否超过限制（25%）

##### Mark-Sweep & Mark—Compact：适用于老生代内存

Mark-Sweep：标记清除，在标记阶段遍历堆中所有对象，并标记活着的对象，在随后的清除阶段中，只清除没有被标记的对象。（死对象在老生代中只占较小部分）
Mark-Compact：标记整理，是为了解决Mark-Sweep算法清理之后内存不连续的情况，是在Mark-Sweep的基础上演变而来。差别在于对象在标记死亡后，在整理的过程中，将活着的对象往一端移动，移动完成后，直接清理掉边界外的内存。要不断移动对象，执行速度不快。所以V8主要使用Mark-Sweep，在空间不足以对从新生代中晋升过来的对象进行分配时才会使用Mark-Compact。

## 高效使用内存

函数作用域释放后（函数执行完），作用域内的局部变量也会在下次垃圾回收中被释放。如果变量是全局变量（不通过var声明或定义在global变量上），由于全局作用域需要等到进程退出才能释放此时将导致引用的对象常驻内存（老生代中），如果需要释放常驻内存的对象，可以通过delete操作来删除引用关系。或者将变量重新复制，让旧对象脱离引用关系，在接下来的老生代内存清除和整理的过程中会被回收释放。
```javascript
global.foo = 'an object'
delete global.foo
//或者重新赋值
global.foo = undefined//or null
```
一般来说在V8中通过重新赋值的方式解除引用比较好一点，因为通过delete删除对象属性有可能干扰V8的优化。
需要注意的是闭包导致原始作用域不能得到释放而导致内存占用不会得到释放。

## 内存指标

### 查看进程的内存占用：```process.memoryUsage()```

rss(resident set size):进程的常驻内存
heapTotal:堆中总共申请的内存量
heapUsed：目前堆中使用中的内存量（字节）

### 查看系统的内存占用

 - os.totalmem()：返回操作系统的总内存
 - os.freemem()：返回操作系统的闲置内存

### 堆外内存

可以通过process.memoryUsage()可以看到堆中的内存用量总是小鱼进程的常驻内存用量，这意味着Node中的内存使用并非都是通过V8进行分配的。将那些不是通过V8分配的内存称为堆外内存。比如Buffer对象就不经过V8的内存分配机制，所以它不会有堆内存的大小限制

## 大内存应用

在Node中不可避免的会存在操作大文件的情况，但是由于Node的内存限制，操作大文件要格外注意。不过Node提供了stream模块用于处理文件。stream是Node原生模块，直接应用即可。
由于V8的内存限制，我们无法通过fs.readFile()和fs.writeFile()直接来进行大文件的操作，而改用fs.createReadStream()和fs.createWriteStream()方法可以通过流的方式对大文件进行操作。