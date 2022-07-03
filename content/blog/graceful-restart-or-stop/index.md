---
title: 如何优雅关机重启
date: 2020-04-25 00:01:41

---

## 背景

web 项目有时候需要更新迭代或者更新项目的配置文件，这时候需要重启 web 服务，然而不能简单粗暴的关机，这样会导致当前接受到的 socket 会处理失败。优雅的关机应该是拒绝新的 socket 连接，等待正在处理的 socket 连接处理完成再退出。


## 优雅的关机

在 go 1.8 之后，net/http 包有一个[Shutdown](https://golang.org/pkg/net/http/#Server.Shutdown)方法。这个方法能够优雅的在不中断正在处理的请求连接的情况下关掉服务。实质上是通过关掉服务上的监听，关掉空闲的连接，然后无限制地等待正在处理的连接完成再关掉服务。

```go
// 来自官网的例子

package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
)

func main() {
	var srv http.Server

	idleConnsClosed := make(chan struct{})
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt)
		<-sigint

		// We received an interrupt signal, shut down.
		if err := srv.Shutdown(context.Background()); err != nil {
			// Error from closing listeners, or context timeout:
			log.Printf("HTTP server Shutdown: %v", err)
		}
		close(idleConnsClosed)
	}()

	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		// Error starting or closing listener:
		log.Fatalf("HTTP server ListenAndServe: %v", err)
	}

	<-idleConnsClosed
}
```

可以看到这里开启了一个 goroutine 接收操作系统的信号，一旦接收到`os.Interrupt`就调用`Shutdown()`，再把`idleConnsClosed`通道给关掉，这样外面的代码就不会阻塞了，至此，函数执行完成。

上面的代码有几个可以优化点

1. 不需要开启新的 goroutine，直接在 main 函数里阻塞就行，这样也就不用特地使用一个通道（上例的`idleConnsClosed`）来通知外层不再阻塞
2. Shutdown()对于正在处理的请求，会无限期地等待连接被释放然后再关停。更好的方法是设置一个时间，恰好 Shutdown()可以接收一个 context,如果 context 比 shutdown 更早完成的话，就会返回一个 context 错误。

```go
func main() {
	var srv http.Server

    // 等待中断信号以优雅地关闭服务器（设置 5 秒的超时时间）
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<- quit // 阻塞
	log.Println("Shutdown Server ...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 在5s内关闭服务，超过5s就超时退出
	if err := srv.Shutdown(ctx); err != nil {
	    log.Fatal("Server Shutdown", err)
	}
	log.Println("Server exiting")
}
```

知识点补充：这里都是接受了`os.Interrupt`信号，其实在`os.Interrupt`就是`syscall.SIGINT`

除了`SIGINT`之外，还有很多其他的信号

```go
const (
    // More invented values for signals
    SIGHUP  = Signal(0x1)
    SIGINT  = Signal(0x2)
    SIGQUIT = Signal(0x3)
    SIGILL  = Signal(0x4)
    SIGTRAP = Signal(0x5)
    SIGABRT = Signal(0x6)
    SIGBUS  = Signal(0x7)
    SIGFPE  = Signal(0x8)
    SIGKILL = Signal(0x9)
    SIGSEGV = Signal(0xb)
    SIGPIPE = Signal(0xd)
    SIGALRM = Signal(0xe)
    SIGTERM = Signal(0xf)
)
```

可以在终端上执行`kill -l`查看系统支持的信号。我们常常通过`kill -9 pid`这种方式来强制关闭进程，本质上就是给进程发送一个`SIGKILL`信号（此信号不能被程序捕捉）。同理`kill -2 pid`就是发送`SIGINT`信号，`kill pid`默认会发送`SIGTERM`信号。有时候使用 Ctrl+C 来中止程序，其发送的是`SIGINT`信号。

具体的请参考[unix 信号](https://zh.wikipedia.org/wiki/Unix%E4%BF%A1%E5%8F%B7)

如果是在 go1.8 之前，可以使用一些库来实现优雅关机:

- [manners](https://github.com/braintree/manners)
- [graceful](https://github.com/tylerb/graceful)

## 优雅的重启

可以使用[fvbock/endless](https://github.com/fvbock/endless)来替换默认的 listener 实现优雅重启。

可以简单看一下 endless 源码

```go
/*
handleSignals listens for os Signals and calls any hooked in function that the
user had registered with the signal.
*/
func (srv *endlessServer) handleSignals() {
	var sig os.Signal

	signal.Notify(
		srv.sigChan,
		hookableSignals...,
	)

	pid := syscall.Getpid()
	for {
		sig = <-srv.sigChan
		srv.signalHooks(PRE_SIGNAL, sig)
		switch sig {
		case syscall.SIGHUP:
			log.Println(pid, "Received SIGHUP. forking.")
			err := srv.fork()
			if err != nil {
				log.Println("Fork err:", err)
			}
		case syscall.SIGUSR1:
			log.Println(pid, "Received SIGUSR1.")
		case syscall.SIGUSR2:
			log.Println(pid, "Received SIGUSR2.")
			srv.hammerTime(0 * time.Second)
		case syscall.SIGINT:
			log.Println(pid, "Received SIGINT.")
			srv.shutdown()
		case syscall.SIGTERM:
			log.Println(pid, "Received SIGTERM.")
			srv.shutdown()
		case syscall.SIGTSTP:
			log.Println(pid, "Received SIGTSTP.")
		default:
			log.Printf("Received %v: nothing i care about...\n", sig)
		}
		srv.signalHooks(POST_SIGNAL, sig)
	}
}
```

可以看到他就是监听了很多信号

- 在接收到`SIGHUP`信号时候将会出发 fork 实现重启。
- 在接收到`SIGINT`和`SIGTERM`时会触发优雅关机
- 在接收到`SIGUSR2`时会调用 hanmerTime

这样的话，就可以通过发送`kill -1 pid`来实现优雅重启了。由于优雅重启使用的是 fork，fork 子进程处理新请求，待原进程处理完当前请求之后在退出。所以前后的 pid 会发生变化。

除了[fvbock/endless](https://github.com/fvbock/endless)，还可使用[grace](https://github.com/facebookarchive/grace)来实现优雅关机和重启。

参考资料

- [Gin Web Framework](优雅地重启或停止)(https://gin-gonic.com/zh-cn/docs/examples/graceful-restart-or-stop/)
- [优雅地关机或重启](https://www.liwenzhou.com/posts/Go/graceful_shutdown/)
- [wikipedia unix 信号](https://zh.wikipedia.org/wiki/Unix%E4%BF%A1%E5%8F%B7)
- [Graceful Restart in Golang](https://grisha.org/blog/2014/06/03/graceful-restart-in-golang/)
