---
title: Redis 初体验
date: 2017-12-06 15:45:59
description: 初学者的角度看Redis
---

Redis是一个支持网络，可基于内存亦可持久化的日志型、key-value数据存储系统。支持string，list，set，zset(有序集合)，hash。而且操作都是原子性的（要么成功执行，要么完全不执行）。redis数据都是缓存在内存中的，和memcached的区别在于redis会周期性的把更新的数据写入磁盘或者把修改操作西写入追加的记录文件。实现master-slave（主从）同步。
<!--more-->

## Redis命令
### redis-server:启动服务器

如果配置好了环境变量，可以直接运行*redis-server.exe redis.windows.conf*开启服务，其中*redis.windows.conf*是配置文件，省略则按照默认配置开启。
如果没有配置好环境变量则需要在redis目录下执行该命令。


### redis-cli:启动客户端
如果配置好了环境变量，可以直接运行命令*redis-cli*或者*redis-cli -h host -p port -a password*启动redis客户端。启动完成之后可以在客户端执行*PING*命令检测redis服务是否启动（如果启动成功会出现PONG）

### Redis键管理
Redis使用key-value的形式存储数据。Redis对键有各种设置，比如设置过期时间啊，修改键名称啊等等
详情请查看[redis键命令][1]。

### Redis字符串
- 设置指定key的值：*SET key value* => SET name jack
- 查询指定key的值：*GET key* => GET name

当然还有很多命令用于处理更加复杂的去设置值为字符串的键值对，比如同时设置多个key-value对，获取指定key所储存的字符串的长度。对key中储存的数字增一等。
详情请查看[redis string命令][2]

### Redis 哈希（hash）
Redis hash是一个string类型的field和value的映射表，hash特别适合存储对象

- 同时将多个field-value对设置到哈希表key中：*HMSET key field1 value1 [field2 value2]* => HMSET info name jack age 22
- 将哈希表key中的字符field的值设为value：*HSET key field value** => HSET info name coco
- 获取存储在哈希表中指定key的所有字段和值：*HGETALL key* => HGETALL info
- 获取存储在哈希表中指定字段的值：*HGET key field* => HGET info name
  还有其他一些命令可以对hash表进行更加复杂的操作，比如获取哈希表中字段的数量，为哈希表key中的指定字段的整数值加上增量。
  详情请查看[redis 哈希命令][3]

### Redis列表（list）
Redis列表是简单的字符串列表，按照插入顺序排序。可以添加到一个元素到列表头（左边）或者尾部（右边）
- 将一个或多个值插入到列表头部：*LPUSH key value1 [value2 value3]* => LPUSH friend coco
- 将一个值插入到已存在的列表头部：*LPUSHX key value* => LPUSHX friend jack 
- 获取列表指定范围内的元素：*LRANGE key start end*=> LRANGE friend 0 10
  还有其他命令可以通过索引获取列表中的元素，获取列表长度，在指定位置插入等待
  详情请查看[redis 列表命令][4]

### Redis集合（set）
Redis的集合是String类型的无序集合，集合成员是唯一的，不能重复。Redis中集合是通过hash表实现的。
- 向集合添加一个或多个成员：*SADD key member1 [member2]* => SADD phone huawei
- 返回集合中的所有成员：*SMEMBERS key* => SMEMBERS phone
  还有其他命令可以实现更复杂的操作，比如返回成员数，移除一个成员
  详情请查看[redis 集合命令][5]

### Redis 有序集合（sorted set）
不允许重复的成员，和set不同的是每个元素都会关联一个double类型的分数。redis通过分数为集合中的成员进行从大到小的排序，有序集合的成员是唯一的。但是分数却可以重复。有序集合也是通过哈希表实现的。
- 向有序集合添加一个或多个成员，或者更新已存在成员的分数：*ZADD key score member [score member2]* => ZADD computer 1 thinkpad
- 通过索引区间返回有序集合指定区间的成员：*ZRANGE key start end* => ZRANGE computer 0 3
  还有其他命令可以移除一个或多个成员，获取有序集合的成员数等。
  详情请查看[redis 有序集合][6]

### Redis HyperLogLog
Redis HyperLogLog是用来做基数统计的算法，HyperLogLog 的优点是，在输入元素的数量或者体积非常非常大时，计算基数所需的空间总是固定 的、并且是很小的。
基数就是不重复元素
- 添加指定元素到 HyperLogLog 中：*PFADD key element [element]* => PFADD exam math
- 返回给定HyperLogLog的基数估算值：*PFCOUNT key*
  详情请查看[redis HyperLogLog][7]
### Redis发布订阅（Pub/Sub）
Redis 发布订阅(pub/sub)是一种消息通信模式：发送者(pub)发送消息，订阅者(sub)接收消息。Redis 客户端可以订阅任意数量的频道。
- 订阅一个或多个频道的信息：*PSUBSCRIBE channel [channel]*
- 将信息发送到指定的频道；*PUBLISH channel message*
  还有一些命令可以用于根据模式去订阅，以及退订
  详情请查看[redis pub/sub][8]

### Redis 事务（transactions）
Redis 事务可以一次执行多个命令， 并且带有以下两个重要的保证：

- 事务是一个单独的隔离操作：事务中的所有命令都会序列化、按顺序地执行。事务在执行的过程中，不会被其他客户端发送来的命令请求所打断。
- 事务是一个原子操作：事务中的命令要么全部被执行，要么全部都不执行。
  一个事务从开始到执行会经历以下三个阶段：
1. 开始事务。
2. 命令入队。
3. 执行事务。
- 标记一个事务块的开始：*MULTI*
- 执行所有事务块：*EXEC*
- 监视一个（或多个）key,如果事务执行之前之歌key被其他命令所改动，那么事务就被打断。
  详情请查看[redis 事务][9]

### Redis脚本
Redis脚本使用Lua解释器来执行脚本。（Redis内嵌了Lua环境）
- 执行Lua脚本：*EVAL script numkeys key [key...] arg [arg...]*
  详情请查看[redis 脚本][10]

### Redis 连接
用于连接Redis服务
- 查看服务是否运行：*PING*
- 验证密码是否正确：*AUTH password*
- 关闭当前连接： *QUIT*
- 切换到指定数据库：*SELECT index*
  详情请查看[redis 连接][11]

### Redis服务器
查看redis服务信息，管理redis服务
- 获取redis服务器各种信息和统计值：*INFO [section]*
  详情请查看[redis 服务器][12]


[1]: http://www.redis.cn/commands.html#generic
[2]: http://www.redis.cn/commands.html#string
[3]: http://www.redis.cn/commands.html#hash
[4]: http://www.redis.cn/commands.html#list
[5]: http://www.redis.cn/commands.html#set
[6]: http://www.redis.cn/commands.html#sorted_set
[7]: http://www.redis.cn/commands.html#hyperloglog
[8]: http://www.redis.cn/commands.html#pubsub
[9]: http://www.redis.cn/commands.html#transactions
[10]: http://www.redis.cn/commands.html#scripting
[11]: http://www.redis.cn/commands.html#connection
[12]: http://www.redis.cn/commands.html#server
