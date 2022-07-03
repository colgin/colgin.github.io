---
title: ssh介绍
date: 2022-02-01 23:52:00
description: 哪怕是最常见的技术，也可以多了解一些
---

我们经常使用ssh来下载github/gitlab 仓库或者实现免密登录远程服务器。这篇文章会介绍一些关于ssh的细节。<!--more-->

## 非对称加密

使用非对称加密算法（比如RSA算法）可以生成一对具有数学关联的密钥，也就是公钥和私钥。公钥可以用来加密数据，只有与其对应的私钥可以解秘数据。而且公钥不能推出私钥。

Alice 和 Bob要发送消息，那就首先两人都生成 各自的 密钥对。两人都将自己的公钥告知对方。当Alice 发送信息给 Bob时，Alice 会使用 Bob的公钥对数据加密，然后将加密的文件发送给Bob，Bob则可以使用自己的私钥将文件解密。由于公钥和私钥的特性，只有Bob可以揭秘Alice发送的信息，即使是Alice也无法揭秘，因为她没有Bob的私钥。所以Alice和Bob钥保存好自己私钥。

非对称加密在 SSL,SSH, PGP, GPG中均有应用

## ssh

通过 `ssh` 登录服务器，比如 `ssh root@11.22.33.44` 即可以`root`用户登录ip为 `11.22.33.44`服务器。这时候，会要求我们输入密码。然而如果我们有很多服务器，每个服务器密码都不一样，岂不是很麻烦，而且同一个服务器密码也可能会换。这时候我们就会使用到ssh 免密登录。要想做到免密登录，就要在本机上先生成密钥对。

1. 使用 `ssh-keygen`生成密钥对

```bash
ssh-keygen
```

不带任何参数，一路回车将会生成一组密钥对在 `~/.ssh/`目录下。

当然也可以给 `ssh-keygen`指定一些参数,`-t`指定算法，`-C`添加注释

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

`ssh-keygen` 默认生成的密钥对名是 `id_rsa`，当然也可以自己指定。待`ssh-keygen`执行完成之后，可以看到 `id_rsa`he `id_rsa.pub`两个文件，这两个文件分别是这个密钥对的私钥和公钥。

2. 将 `id_rsa.pub`文件内容复制到目标服务器`~/.ssh/authorized_keys`文件中

   注意，这里要放到你要登录的用户的用户目录下，比如你想以root用户登录，那就要添加到 `/root/.ssh/authorized_keys`中，如果是以 jack用户登录，就要添加到 `/Users/jack/.ssh/authozied_keys` 中。

   可以现在本机使用 `cat`命令查看 公钥，将内容复制到粘贴板上，再登录服务器，将公钥粘贴到 authozied_keys文件中（如果没有的话，就需要手动创建）

   也可以使用 `ssh-copy-id -i ~/.ssh/id_rsa.pub root@11.22.33.44`将公钥内容写到目标服务器的.ssh目录下

3. 在本机使用 `ssh root@11.22.33.44`登录，就不需要密码了

有时候本机会有几个密钥对，而`ssh root@11.22.33.44` 默认会使用`id_rsa`这个密钥对。如果你设置在服务器上authorized_keys上的公钥不是`id_rsa.pub`的话，会发现免密登录失效了。这时候就需要我们通过 `-i`参数指定密钥来进行ssh登录，假如前面的步骤我们生成的密钥对是 `test`和`test.pub`，我们已经将`test.pub`粘贴到服务器的`.ssh`目录下了，此时 可以通过`ssh -i ~/.ssh/test root@11.22.33.44` 指定使用 test密钥进行加密发送。

然而这样每次都要指定也很麻烦，可以参考在本机`~/.ssh/config`配置ssh 登录

```conf
Host tengxunyun
HostName 11.22.33.44
User root
IdentityFile ~/.ssh/ecs_rsa
```

这样之后就可以直接`ssh tengxunyun` 登录服务器了。是不是一下子方便了很多呢？

### sshd 

sshd是服务器端ssh的守护进程，可以做一些ssh登录配置，其配置文件在`/etc/ssh/sshd_config`

```
# 禁用密码登录
PasswordAuthentication no
ChallengeResponseAuthentication no

# 调整ssh连接保持时间
ClientAliveCountMax 300
ClientAliveInterval 0
```

## 参考

1. [四分钟搞明白非对称加密](https://www.bilibili.com/video/BV134411r7Kt)
2. [SSH Config 那些你所知道和不知道的事](https://deepzz.com/post/how-to-setup-ssh-config.html)
3. [ssh免密登的原理](https://www.bilibili.com/video/BV1y4411q7PW)
4. [sshd_config配置详解](https://www.jianshu.com/p/e87bb207977c)
5. [github doc](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
