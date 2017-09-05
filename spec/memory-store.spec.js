const memoryStore = require('../dist/memory-store.js').MemoryCacheStore

let memstore

describe('测试MemoryStore模块', () => {
    beforeEach(() => {
        memstore = new memoryStore(2, 400)
    }, 3000)
    it('测试超时的case 超时后无法再取值 size等于0', done => {
        let key = 'test', value = 1
        let ret = memstore.put(key, value, 40)
        expect(ret).toEqual(value)
        setTimeout(() => {
            ret = memstore.get(key)
            expect(ret).not.toEqual(undefined)
            expect(memstore.size).toEqual(1)
            expect(memstore.__size).toEqual(1)
        }, 200)
        setTimeout(() => {
            ret = memstore.get(key)
            expect(ret).toEqual(undefined)
            expect(memstore.size).toEqual(0)
            expect(memstore.__size).toEqual(0)
            done()
        }, 500)
    })
    it('测试超时之前 重新保存一个新的值 过期时间会自动延长 并且不会删除之前保存的值', function (done) {
        let key = 'test', value = 1
        let ret = memstore.put(key, value, 200)
        expect(ret).toEqual(value)
        setTimeout(() => {
            value = 2
            ret = memstore.put(key, value, 300)
            expect(ret).toEqual(value)
        }, 200)
        setTimeout(function () {
            ret = memstore.get(key)
            expect(ret).toEqual(value)
            expect(memstore.size).toEqual(1)
            expect(memstore.__size).toEqual(1)
            done()
        }, 600);
    })
    it('测试过期的轮询处理中 只删除过期的数据', done => {
        let key1 = 'test1', value1 = 1,
            key2 = 'test2', value2 = 2
        memstore.put(key1, value1, 200)
        memstore.put(key2, value2)
        setTimeout(() => {
            let ret = memstore.get(key2)
            expect(ret).toEqual(value2)
            expect(memstore.size).toEqual(1)
            expect(memstore.__size).toEqual(1)
            done()
        }, 500)
    })
    it('测试清除缓存中所有的数据', done => {
        let key = 'test', value = 1
        memstore.put(key, value, 100)
        memstore.clear()
        expect(memstore.size).toEqual(0)
        expect(memstore.__size).toEqual(0)
        done()
    })
    it('测试过期时间只能为正数', done => {
        let key = 'test', value = 1, expire = '', err
        try {
            memstore.put(key, value, expire)
        } catch (e) {
            err = e
        }
        expect(err).not.toEqual(undefined)
        err = undefined, expire = 0
        try {
            memstore.put(key, value, expire)
        } catch (e) {
            err = e
        }
        expect(err).not.toEqual(undefined)
        err = undefined, expire = -1
        try {
            memstore.put(key, value, expire)
        } catch (e) {
            err = e
        }
        expect(err).not.toEqual(undefined)
        done()
    })
    it('测试正常case 存一个值 然后返回结果', done => {
        let key = 'test', value = 1
        let ret = memstore.put(key, value)
        expect(ret).toEqual(value)
        done()
    })
    it('测试容量到达最大时 再追加数据的时候 会删除目前最后被访问过的数据', done => {
        let key1 = 'test1', key2 = 'test2', key3 = 'test3', value1 = 1, value2 = 2, value3 = 3
        memstore.put(key1, value1)
        setTimeout(() => {
            memstore.put(key2, value2)
        }, 100)
        setTimeout(() => {
            memstore.put(key3, value3)
        }, 200)
        setTimeout(() => {
            let ret = memstore.get(key1)
            expect(ret).toEqual(undefined)
            ret = memstore.get(key2)
            expect(ret).toEqual(value2)
            ret = memstore.get(key3)
            expect(ret).toEqual(value3)
            expect(memstore.size).toEqual(2)
            expect(memstore.__size).toEqual(2)
            done()
        }, 300)
    })
    it('测试删除缓存中的一个key值', done => {
        let key = 'test', value = 1
        memstore.put(key, value)
        memstore.delete(key)
        let ret = memstore.get(key)
        expect(ret).toEqual(undefined)
        expect(memstore.size).toEqual(0)
        expect(memstore.__size).toEqual(0)
        done()
    })
    it('测试读取或者删除缓存中不存在的键值', done => {
        let key = 'xxx'
        let ret = memstore.get(key)
        expect(ret).toEqual(undefined)
        ret = memstore.delete(key)
        expect(ret).toEqual(undefined)
        done()
    })
})