이 문서는 QA를 진행하기 전에 코드를 살펴보며 느낀 점들과, QA를 통해 함께 나누고 싶은 내용을 정리한 문서예요.

1. 각자 따로 프로젝트를 만든 뒤 합치는 방식이라, 이 부분에서 몇 가지 어려움이 생길 수 있을 것 같아요.
    폴더를 살펴보니 최상위 폴더에 .gitignore 파일이 이미 있는데도, 각자의 폴더 안에도 .gitignore 파일이 따로 있는 것을 확인했어요. (10.15. 20시 기준)
    이렇게 되면 같은 설정이 중복되는 것뿐만 아니라, 제외할 파일 목록이 서로 겹치거나, 내가 제외한 파일이 사실은 동료에게 꼭 필요한 파일이라서 프로젝트가 제대로 완성되지 않는 문제가 생길 수도 있어요.
    그래서 최상위 폴더의 /ad/.gitignore 파일 하나로 통합하고, 나머지 .gitignore 파일은 정리해 보면 좋을 것 같습니다.

2. 각자의 환경에서 실행하다 보니 패키지 버전이 서로 달라요.
    지금은 ad_prototype에서 통합된 것으로 보이지만, 각자 자신의 폴더 안에 있는 package.json을 사용하고 있어서 react, @types/react(-dom), vite, @vitejs/plugin-react, tailwindcss, typescript, @types/node의 버전이 서로 다른 것을 확인했어요. 많이 차이 나는 경우에는 메이저 버전이 네 가지나 다른 경우도 있었어요. 버전을 한번 맞춰보면 좋을 것 같습니다.

3. 참고해 주세요
    Vercel을 사용할 때 push를 너무 자주 하면 계정 한도가 소진되어 업데이트가 안 될 수도 있으니, 조금 신경 써 주시면 좋겠어요.

4. ad_prototype 폴더에서 발견한 부분
    알파 버전이라고 볼 수 있는 ad_prototype 폴더를 열어보니, 가장 먼저 빨간 오류 표시가 보였어요. 아래 내용을 참고해서 한번 확인해 주시면 감사하겠습니다.
    ```
    'baseUrl’ 옵션은 더 이상 사용되지 않으며 TypeScript 7.0에서 작동하지 않습니다. 이 오류를 무시하려면 compilerOption '"ignoreDeprecations": "6.0"'을(를) 지정합니다.
    마이그레이션 정보를 보려면 https://aka.ms/ts6을 방문하세요.ts
    Sets a base directory from which to resolve bare specifier module names. For example, in the directory structure:

    project
    ├── ex.ts
    ├── hello
    │   └── world.ts
    └── tsconfig.json
    With "baseUrl": "./", TypeScript will look for files starting at the same folder as the tsconfig.json:

    import { helloWorld } from "hello/world";