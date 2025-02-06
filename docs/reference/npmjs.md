# mpm

## NPM 로컬 로그인

```sh
# 로그인
$ npm login jnjsoftko

# 인증: OPT code 입력 >
-  OTP for logging in to your account:
The OTP code is: 34907414

Authentication Successful

# 로그인 확인
$ npm whoami

jnjsoftko
moondevnode
```

## NPM update

```sh
# patch(0.0.1 -> 0.0.2)
$ npm version patch [-m "Upgrade to %s for reasons"]

# minor(0.0.1 -> 0.1.0)
$ npm version minor

# major(0.0.1 -> 1.0.0)
$ npm version major
```

## NPM publish

```sh
$ npm publish
```

====

## npm publish

'npm publish'를 했는데, 에러가 발생하고, update가 안됩니다.

어떻게 해야 하나요?

> error

"""

npm ERR! Git working directory not clean.

npm ERR! A complete log of this run can be found in: C:\Users\Jungsam\AppData\Local\npm-cache_logs\2024-04-01T13_29_13_208Z-debug-0.log

"""

NPM에서 에러가 발생하고 게시가 되지 않는 경우, 대부분 몇 가지 일반적인 문제로 인한 것입니다. 제공된 에러 메시지에 따르면 깃 작업 디렉토리가 깨끗하지 않다는 것을 알 수 있습니다.
