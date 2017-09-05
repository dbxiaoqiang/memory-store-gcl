import {
    NiDataFactory,
    NiDataConnection,
} from 'gcl/com/coooders/db/ni'
import commonTool from 'gcl/com/coooders/common/tool'
import Yallist from 'yallist'

export class MemoryCacheFactory extends NiDataFactory {
    constructor(parser, maxSize, cycle) {
        super()
        let fac_context = this
        const { _, __ } = pris(fac_context, {
            MemCacheConnection: class extends NiDataConnection {
                constructor() {
                    super()
                    let con_context = this
                    const { __ } = pris(con_context, {
                        cmds: [],
                        conn: null,
                        memCache: new MemoryCacheStore(fac_context.maxSize, fac_context.cycle),
                        invoke: async (command, params) => {
                            const { __ } = pris(con_context)
                            let queryList = fac_context.parser.parse(command, parmas)
                            let data = []
                            await commonTool.each(queryList, async (v, call) => {
                                let cacheKey = __.getKey(v)
                                switch (v.Method.toLowerCase().trim()) {
                                    case 'select':
                                        data[data.length] = __.memCache.get(cacheKey)
                                        break;
                                    case 'insert':
                                    case 'update':
                                        data[data.length] = __.memCache.put(cacheKey)
                                        break;
                                    case 'delete':
                                        data[data.length] = __.memCache.delete(cacheKey)
                                        break;
                                }
                                return false
                            }, true)
                        },
                        getKey: v => {
                            let cacheKey = v.Table
                            if (v.Params['cacheKey']) {
                                cacheKey = (commonTool.hash(v.Params['cacheKey'], true))
                            } else {
                                throw new Error('表未定义主键 或者传入的值中未找到cacheKey')
                            }
                            return cacheKey
                        }
                    })
                }
                async invoke(cmd) {
                    const { _, __ } = pris(this)
                    if (_.transaction) {
                        __.cmd[__.cmd.length] = {
                            command: cmd.command,
                            params: cmd.params,
                        }
                    } else {
                        return await __.invoke(cmd.command, cmd.params)
                    }
                }
                async close() {
                    const { __ } = pris(this)
                    __.cmds = []
                    await super.close()
                }
            }
        })
        _.parser = parser, _.maxSize = maxSize, _.cycle = cycle
    }
    createDBConnection() {
        const { __ } = pris(this)
        return new __.MemCacheConnection()
    }
    backDBConnection(conn) {
        conn.close()
    }
}
/**
 * Memory cache 的具体实现 缓存过期策略 采用LRU算法
 * 默认最大可以缓存1万条数
 * 只可以做一些Master数据的缓存 如果想保存其他的数据 例如Session 必须使用第三方的缓存 例如: Redis
 */
export class MemoryCacheStore {
    constructor(maxSize = 10000, cycle = 5000) {
        const { _, __ } = pris(this, {
            cache: Object.create(null),
            lruLink: new Yallist(),
            timeoutId: undefined,
            size: 0,
            maxSize: maxSize,
            cycle: cycle,
            expire() {
                let tail = this.lruLink.tail
                if (tail) {
                    delete this.cache[tail.value.key]
                    this.lruLink.removeNode(tail)
                    this.size--
                }
            },
            polling() {
                this.timeoutId = setTimeout.call(this, () => {
                    let now = Date.now(), data
                    for (let tail = this.lruLink.tail; tail;) {
                        data = tail.value
                        if ((data.time + data.expire) <= now) {
                            delete this.cache[data.key]
                            this.lruLink.removeNode(tail)
                            this.size--
                            tail = tail.pre
                        }
                    }
                    this.polling()
                }, this.cycle)
            },
            reset() {
                this.cache = Object.create(null)
                this.size = 0
                this.lruLink = new Yallist()
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId)
                }
                this.polling()
            }
        })
        __.reset()
    }
    /**
     * 按照键值对 保存数据
     * 数据有过期时间 默认为1天 过期后 数据自动删除
     * 达到最大容量后 按照LRU原则 删除最后访问时间最晚的数据
     * @param {*} key 唯一主键
     * @param {*} value 保存的数据
     * @param {*} expire 过期时间 默认为1天
     */
    put(key, value, expire = 1440000) {
        if (typeof expire !== 'number' || isNaN(expire) || expire <= 0) {
            throw new Error('请输入正确的过期时间')
        }
        const { _, __ } = pris(this)
        let oldRecord = __.cache[key]
        if (!oldRecord) {
            if (__.size >= __.maxSize) {
                __.expire()
            }
            __.size++
        }
        let now = Date.now(), data = {
            key: key,
            value: value,
            time: now,
            expire: expire,
        }
        __.cache[key] = data
        __.lruLink.unshift(data)
        return data.value
    }
    /**
     * 从缓存里按照给定的Key值读取数据
     * 读取不到的情况 返回undefined
     * 读取到数据的情况下 更新数据的访问时间
     * @param {*} key 唯一的Key值
     */
    get(key) {
        const { __ } = pris(this)
        let data = __.cache[key]
        if (!data) {
            return undefined
        }
        data.time = Date.now()
        return data.value
    }
    /**
     * 删除缓存中指定key对应的数据
     * @param {*} key 唯一的主键
     */
    delete(key) {
        const { __ } = pris(this)
        let oldRecord = __.cache[key]
        if (oldRecord) {
            clearTimeout(oldRecord.timeout)
            delete __.cache[key]
            return oldRecord
        }
        return undefined
    }
    /**
     * 清除缓存中的数据
     * 同时清除掉所有的expire timer
     */
    clear() {
        const { __ } = pris(this)
        __.reset()
    }
    /**
     * 返回缓存中保存的数据条数
     */
    get size() {
        const { __ } = pris(this)
        return __.size
    }
}
const pris = commonTool.pris()