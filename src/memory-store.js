import {
    NiDataFactory,
    NiDataConnection,
} from 'gcl/com/coooders/db/ni'
import commonTool from 'gcl/com/coooders/common/tool'

export class MemoryCacheFactory extends NiDataFactory {
    constructor(parser, maxSize) {
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
                        memCache: new MemoryCacheStore(fac_context.maxSize),
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
        _.parser = parser, _.maxSize = maxSize
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
    constructor(maxSize) {
        const { _, __ } = pris(this, {
            cache: Object.create(null),
            size: 0,
            maxSize: maxSize ? maxSize : 10000,
            expire() {
                let key, earliest = Number.MAX_VALUE;
                commonTool.forC(this.cache, (k, v) => {
                    if (v.time < earliest) {
                        earliest = v.time
                        key = k
                    }
                }, true)
                if (key) {
                    let data = this.cache[key]
                    clearTimeout(data.timeout)
                    delete this.cache[key]
                    this.size--
                }
            }
        })
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
        if (oldRecord) {
            clearTimeout(oldRecord.timeout)
        } else {
            if (__.size >= __.maxSize) {
                __.expire()
            }
            __.size++
        }
        let now = Date.now(), data = {
            value: value,
            expire: now + expire,
            time: now
        }
        data.timeout = setTimeout(function () {
            delete __.cache[key]
            __.size--
        }, expire)
        __.cache[key] = data
        return data.value
    }
    /**
     * 从缓存里按照给定的Key值读取数据
     * 读取不到的情况 返回undefined
     * @param {*} key 唯一的Key值
     */
    get(key) {
        const { __ } = pris(this)
        let data = __.cache[key]
        if (typeof data == 'undefined') {
            return undefined
        }
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
        commonTool.forC(__.cache, (k, v) => {
            clearTimeout(v.timemout)
        }, true)
        __.size = 0
        __.cache = Object.create(null)
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