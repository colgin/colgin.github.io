---
title: 一些有意思的点滴
date: 2021-06-04 09:03:47
description: 遇到有意思的事情，就记录下来吧～
---

## esbuild

esbuild 的watch模式实现是一个优化版的轮训。不用os的 fs是因为 portability(这里存疑？)

具体是怎么优化的呢？

Watch mode in esbuild is implemented using polling instead of OS-specific file system APIs for portability. The polling system is designed to use relatively little CPU vs. a more traditional polling system that scans the whole directory tree at once. The file system is still scanned regularly but each scan only checks a random subset of your files, which means a change to a file will be picked up soon after the change is made but not necessarily instantly.

With the current heuristics, large projects should be completely scanned around every 2 seconds so in the worst case it could take up to 2 seconds for a change to be noticed. However, after a change has been noticed the change's path goes on a short list of recently changed paths which are checked on every scan, so further changes to recently changed files should be noticed almost instantly.

每次扫描都只扫描一部分文件，发现变化的文件，之后这个文件的更新 就能被立刻注意到。

有意思～
