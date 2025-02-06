@echo off
REM [syntax] publish [patch|minor|major] [-m "commit message"]
REM default: patch, "chore: build for publish"

SET mode=patch
SET commit_msg=chore: build for publish

:parse_args
IF "%~1"=="" GOTO end_parse
IF "%~1"=="-m" (
  SET commit_msg=%~2
  SHIFT
  SHIFT
  GOTO parse_args
)
IF "%~1"=="patch" (
  SET mode=patch
  SHIFT
  GOTO parse_args
)
IF "%~1"=="minor" (
  SET mode=minor
  SHIFT
  GOTO parse_args
)
IF "%~1"=="major" (
  SET mode=major
  SHIFT
  GOTO parse_args
)
SHIFT
GOTO parse_args
:end_parse

REM 1. git pull 먼저 실행하여 원격 변경사항 가져오기
git pull
if errorlevel 1 goto :error

REM 2. 빌드
@REM call yarn clean:win
@REM if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error

REM 3. git 변경사항 커밋
git add .
if errorlevel 1 goto :error
git commit -m "%commit_msg%"
if errorlevel 1 goto :error

REM 4. npm 버전 업데이트 (이때 자동으로 버전 태그가 생성됨)
call npm version %mode%
if errorlevel 1 goto :error

REM 5. git push
git push --follow-tags
if errorlevel 1 goto :error

REM 6. npm 배포
call npm publish
if errorlevel 1 goto :error

goto :success

:error
echo 오류가 발생했습니다.
exit /b 1

:success
echo 배포가 성공적으로 완료되었습니다.
exit /b 0