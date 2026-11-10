# 犬影村 微信小程序

## 开发注意事项

### 1. npm 构建前必须修复 phoenix 包语法

`supabase-wechat-stable-v2` 依赖的 `phoenix@1.8.5` 包使用了 ES2019 的「可选 catch 绑定」语法，微信小程序的 JS 解析器不支持。

**每次 `npm install` 之后、构建 npm 之前**，需要手动修复：

**文件**：`node_modules/phoenix/priv/static/phoenix.cjs.js`
**第 602 行**，将：

```javascript
} catch {
```

改为：

```javascript
} catch(e) {
```

修复后再在微信开发者工具中执行「工具 → 构建 npm」。

### 2. 服务器域名白名单配置

小程序在非调试模式下访问网络接口，需要在 [微信公众平台](https://mp.weixin.qq.com) 中配置合法域名。

**配置路径**：微信公众平台 → 开发管理 → 开发设置 → 服务器域名

需要添加以下域名到 **request 合法域名**：

```
https://cwdortmihyhyqzlhicoa.supabase.co
```

> ⚠️ 如果不配置，小程序在真机上只有开启「开发调试」模式才能正常请求接口，正式发布后将无法使用。

### 3. 项目配置说明

- `packNpmManually` 设置为 `true`，手动指定 npm 构建范围
- `packNpmRelationList` 指定了 `package.json` 路径和输出目录
- 所有 JS 文件使用 **CommonJS**（`require` / `module.exports`）语法，不使用 ES Module
