# 犬影村管理平台

Vue + Electron 管理端。数据库迁移、管理员配置、导入规则及验收方法见 [项目说明](../README.md)。

```sh
npm ci
npm test
npm run desktop
```

`npm run dev` 启动浏览器开发环境；`npm run pack` 生成桌面目录包。配置 Supabase 后需重新构建。不要将管理密钥写入客户端。
