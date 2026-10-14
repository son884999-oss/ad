이 문서는 QA를 실행하기 이전 이 코드뭉치들을 보며 느낀 생각들과 QA를 하기 위해 전달하는 목적을 담은 문서임을 미리 밝힙니다.

1. 각 인원마다 따로 프로젝트를 만든 뒤 합치는 것이 이 프로젝트의 큰 문제점이 된 형태입니다.
    각자의 폴더를 보았을 때 최상위 폴더에 .gitignore 파일이 있음에도 각자의 폴더에 .gitignore파일이 있음을 확인했습니다. (10.15.20시 기준)
    이는 똑같은 폴더를 복제한 것의 문제를 넘어 이미 제외한 파일이 겹친것, '나'는 올리지 않아야 하는 파일을 넣었으나 '동료'가 올려야 하는 파일이 들어가 완성할 수 없도록 만드는 문제가 있을 수 있습니다.
    고로, 최상위 폴더인 /ad/.gitignore 파일 외 다른 .gitignore파일을 통합 및 삭제를 하여야 합니다.

2. 각자의 환경에서 실행을 하다보니 버전에 문제가 있음
    작성일 기준에서는 ad_prototype에서 통합한 것을 보이고 있으나, 각자 자신의 폴더 내에 package.json파일을 사용하기 때문에 react, @types/react(-dom), vite, @vitejs/plugin-react, tailwindcss, typescript, @types/node의 버전이 다른 것을 확인할 수 있습니다. 심한 경우 메이저 버전이 4개다 다른 버전을 사용하는 것을 볼 수 있습니다.

3. 주의사항
    vercel을 사용시 push를 자주 사용하게 된다면 계정 내 한도가 떨어져 업데이트가 불가능 할 수 있음.

4. ad_prototype 폴더 자체의 문제
    알파버전으로 볼 수 있는 ad_prototype 폴더를 확인하며 제일 처음 보이는 것이 빨간 오류가 있음. 
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