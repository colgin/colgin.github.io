---
title: Node中的网络编程
date: 2017-11-25 19:15:40
description: 网络编程是一门语言经典的话题
---

在web领域，大多数编程语言需要专门的web服务器作为容器，如ASP、ASP.NET需要IIS作为服务器，PHP需要搭载Apache或Nginx环境，JSP需要Tomcat服务器等，但是Node只需要几行代码就可以构建服务器，无需额外的容器。Node提供net、dgram、http、https分别处理TCP、UDP、HTTP、HTTPS，适用于服务端和客户端。
<!--more-->

## 构建TCP服务

TCP中连接一旦建立，所有的回话都基于连接完成，客户端如果想和另一个TCP服务器通信，需要另外创建一个套接字来连接
```javascript
//服务端
var net = require('net')
var server = net.createServer(function(socket) {
    socket.on('data',function(data) {
        socket.write('hello')
    })
    socket.on('end',function() {
        console.log('连接断开')
    })
  	socket.write('welcome')
})
server.listen(8124,function() {
    console.log('server is running')
})
```
```javascript
//客户端
var net = require('net')
var client = net.connect({port:8124},function() {
    console.log('client connected')
})
client.on('data',function(data) {
    console.log(data.toString())
    client.end()
})
client.on('end',function() {
    console.log('client disconnected')
})
```

服务器可以同时和多个客户端保持连接，每个连接都是可读可写的Stream对象。
另外需要注意的是TCP针对网络中的小数据包有一定的优化策略：Nagle算法。如果每次只发送一个字节的内容而不优化，网络中只有极少数有效数据的数据包，将十分浪费网络资源，Nagle算法针对这种情况，要求缓冲区的数据达到一定数据或者一定时间后才将其发出。所以小数据包会被Nagle算法合并，以此优化网络，这种优化虽然使得网络宽带被有效地利用，但是数据有可能被延迟发送。在Node中，TCP默认开启Nagle算法，可以通过socket.setNoDelay(true)去掉Nagle算法，使得write()可以立即发送数据到网络中。尽管在网络的一端调用write()会调用另一端的data事件，但是并不是意味着每次write()都会触发data事件，在关掉Nagle算法后，另一端肯能会将接收到多个小数据包合并，然后值触发一次data事件。

## 构建UDP服务

UDP中一个套接字可以与多个UDP服务通信。
```javascript
//服务器
var dgram = require('dagram')
var server = dgram.createSocket('udp4');
server.on('message',function(msg,rinfo) {
    console.log('server got: ' + msg + rinfo.address + ':' + rinfo.port) 
})
server.on('listening',function() {
    var address = server.address()
    console.log('server listening' + address.address + ':' + address.port)
})
server.bind(41234)
```
```
//客户端
var dgram = require('dgram')
var messge = new Buffer('hello world')
var client = dgram.createSocket('udp4')
client.send(message,0,message.length,41234,'localhost',function(err,bytes) {
    client.close()
})
```

## 构建HTTP服务

应用层协议，是对TCP的高级封装。TCP服务以connection为单位进行服务，HTTP服务以request为单位进行服务。http模块是将connection到request进行了封装。http模块将连接所用套接字的读写抽象为ServerRequest和ServerResponse对象。在请求过程中个，http模块拿到连接中传来的数据，调用二进制模块http_parser进行解析，在解析完成请求报文之后，触发request事件，调用用户逻辑。

### HTTP请求

请求报文体部分抽象为一个只读流对象，如果业务逻辑需要读取报文中的数据流结束之后才能进行操作
```javascript
function(req,res) {
    var buffers = []
    req.on('data',function(chunk) {
        buffers.push(chunk)
    })
    req.on('end',function() {
        var buffer = Buffer.concat(buffers)
        //业务逻辑
        res.end('hello world')
    })
}
```

### http响应

它封装了对底层连接的写操作，可以看做是一个可写的流对象。可以用res.setHeader()和res.writeHead()来设置头信息。在实际应用中，我们可以多次调用setHeader()进行设置，但只有调用writeHeader()后，报头才会写入连接中。
报文体部分则是通过调用res.write()和res.end()方法实现。后者和前者的差别在于res.end()会先调用write()发送数据，然后发送信号告知服务器这次响应结束。
需要注意的是无论服务器端处理业务时是否发生异常，务必在结束时调用res.end()结束请求，否则客户端将一直处于等待状态（pending）。当然也可以通过延迟res.end()来实现客户端和服务端之间的长连接，但结束时务必关闭连接。

#### HTTP服务器事件

 - connection事件:在开始HTTP请求之前，客户端与服务器需要建立底层的TCP连接，这个连接可能因为开启了keep-alive，可以在多个请求响应之间使用，当这个连接建立时，服务器就触发了一次connection事件
 - request事件:建立TCP连接后，http模块底层将在数据流中抽象出HTTP请求和HTTP响应，当请求数据发送到服务器端，在解析出HTTP请求头后，将会触发该事件；res.end()后，TCP连接可能用于下一次请求响应

### HTTP代理

在TCP keep-alive的情况下，一个底层连接可以多次用于请求。http模块包含了一个默认的客户端代理对象http.globalAgent。通过ClientRequest对象对同一个服务器端发起的HTTP请求时，最多可以创建5个连接。如果HTTP客户端同时对一个服务器发起10次HTTP请求，实质上只有5个请求处于并发状态，后续请求需要等待某个请求完成服务后才真正发出。可以通过设置agent:false。脱离连接池管理，使得请求不受并发限制。

## 构建websocket服务

### websocket相对于HTTP有以下好处

 - 客户端和服务端只需要建立一个TCP连接，可以使用更少的连接
 - websocket服务端可以推送数据到客户端，远比HTTP请求响应模式更灵活，更高效。之前是用长轮询的技术实现服务器推送。
 - 有更轻量的头，减少数据传送量
另外需要注意的是websocket的握手部分是有HTTP完成的

### websocket握手

## 网络服务与安全

Node在网络安全上提供给了三个模块，crypto、tls、https。其中crypto主要用于加密解密，sha1、md5等加密算法都有。tls模块归功了与net模块类似的功能，区别在于它建立在TLS/SSL加密的TCP连接上。对于https而言，它完全和http模块一致，区别在于它建立在安全的连接之上。

### TLS/SSL

SSL是NetScape提出的安全协议(Secure Sockets Layer 安全套接层)。TLS是IETF的标准化实现(Transport Layer Security安全传输层协议)。

### 密钥

TLS/SSL是一个公钥/私钥的结构，他是一个非对称的结构，每个服务器和客户端都有自己的公钥和私钥。公钥用来加密要传输的数据，私钥用来解密收到的数据。公钥和私钥是配对的，通过公钥加密的数据，只有通过私钥才能解密，所以在建立安全的传输之前，客户端和服务端之间要互换公钥。客户端发送数据时要通过服务器的公钥进行加密，服务器发送数据时需要通过客户端的公钥进行加密。这样就可以完成加密解密的过程。
但是这样仍然存在窃听的情况，比如说中间人攻击。客户端和服务端在交换公钥过程中，中间人对客户端扮演服务器的角色，对服务器扮演客户端的角色，因此客户端和服务端都感受不到中间人的存在。而为了解决这个问题，TLS/SSL引入了数字证书来进行验证。

### 数字证书

与直接交换公钥不同，数字证书中包含了服务器的名称和主机名、服务器的公钥、签名颁发机构的名称，来自签名颁发机构的签名，在连接之前，会通过证书中的签名确认收到的公钥是来自目标服务器，从而产生信任关系。CA(Certificate Authority)为站点颁发证书，这个证书具有CA通过自己的公钥和私钥实现的签名。服务器需要通过自己的私钥生成CSR(Certificate Signing Request,证书签名请求)文件，CA机构将通过这个文件颁发属于该服务器的签名证书，只要从国CA机构就能验证证书是否合法。
