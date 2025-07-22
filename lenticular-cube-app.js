let scene, camera, renderer;
let cube;
let currentEffectIndex = 0;
let currentAngleStep = 3; // 0-6の7段階、3が中央

// 7段階の角度名と対応する立方体の回転角度
const angleNames = ['左々', '左+', '左', '中央', '右', '右+', '右々'];
const cubeRotations = [
    { x: 0, y: -Math.PI * 0.6 },    // 左々: 左に108度
    { x: 0, y: -Math.PI * 0.4 },    // 左+: 左に72度
    { x: 0, y: -Math.PI * 0.2 },    // 左: 左に36度
    { x: 0, y: 0 },                 // 中央: 正面
    { x: 0, y: Math.PI * 0.2 },     // 右: 右に36度
    { x: 0, y: Math.PI * 0.4 },     // 右+: 右に72度
    { x: 0, y: Math.PI * 0.6 }      // 右々: 右に108度
];

const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// エフェクト1: ビックリマンホログラム
const fragmentShader1 = `
    uniform float time;
    uniform int angleStep;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        vec3 viewDir = normalize(vViewPosition);
        vec3 normal = normalize(vNormal);
        
        // 立方体の面ごとに異なるパターン（角度ステップで変化）
        float facePattern = 0.0;
        if(abs(normal.x) > 0.9) facePattern = float(angleStep) * 0.3; // 左右面
        else if(abs(normal.y) > 0.9) facePattern = float(angleStep) * 0.5; // 上下面
        else if(abs(normal.z) > 0.9) facePattern = float(angleStep) * 0.7; // 前後面
        
        // 放射状パターン（面ごとに異なる）
        vec2 faceUV = vUv - 0.5;
        float angle = atan(faceUV.y, faceUV.x) + facePattern;
        float radius = length(faceUV);
        
        // 角度ステップによる放射パターンの回転
        float rotationOffset = float(angleStep) * 0.52;
        
        // 放射状虹色（角度ステップで色相変化）
        float stripeCount = 12.0;
        float stripe = fract((angle + rotationOffset) * stripeCount / (2.0 * 3.14159) + time * 0.1);
        
        // 角度ステップによる色相シフト
        float hueShift = float(angleStep) * 0.14 + facePattern;
        vec3 hologramColor = hsv2rgb(vec3(stripe * 0.2 + hueShift + time * 0.05, 0.9, 1.0));
        
        // 金属光沢（角度で強度変化）
        float metallic = pow(stripe, 3.0);
        float metallicIntensity = 0.3 + abs(float(angleStep - 3)) * 0.1;
        vec3 metallicColor = mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 1.0, 1.0), metallic);
        
        // スターバースト（各面の中心から、角度で向きが変わる）
        float burst = 0.0;
        for(float i = 0.0; i < 4.0; i++) {
            float burstAngle = i * 3.14159 / 2.0 + time * 0.5 + rotationOffset;
            vec2 burstDir = vec2(cos(burstAngle), sin(burstAngle));
            float burstDot = abs(dot(normalize(faceUV), burstDir));
            burst += pow(burstDot, 30.0) * (1.0 - radius * 2.0);
        }
        
        // キラキラ粒子（角度で密度変化）
        vec2 sparklePos = vUv * (15.0 + float(angleStep) * 2.0);
        float sparklePhase = time * 5.0 + float(angleStep) * 0.5 + facePattern;
        float sparkle = smoothstep(0.98, 1.0, sin(sparklePos.x + sparklePhase) * sin(sparklePos.y - sparklePhase));
        
        // 角度による強度調整
        float angleFactor = abs(float(angleStep - 3)) / 3.0;
        
        vec3 finalColor = vec3(0.1, 0.05, 0.15);
        finalColor += hologramColor * (0.4 + angleFactor * 0.2);
        finalColor += metallicColor * metallic * metallicIntensity;
        finalColor += vec3(burst) * (0.8 + angleFactor * 0.4);
        finalColor += vec3(sparkle) * (1.2 + angleFactor * 0.6);
        
        // 傾きによる輝度変化
        finalColor *= 1.0 + angleFactor * 0.3;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// エフェクト2: プリズム分光
const fragmentShader2 = `
    uniform float time;
    uniform int angleStep;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    
    void main() {
        vec3 viewDir = normalize(vViewPosition);
        vec3 normal = normalize(vNormal);
        
        // 角度ステップによるプリズム効果
        float angleOffset = float(angleStep - 3) * 0.3;
        
        // 面ごとの基本色
        vec3 baseColor = vec3(0.1, 0.1, 0.2);
        if(abs(normal.x) > 0.9) baseColor = vec3(0.2, 0.1, 0.1); // 左右面は赤系
        else if(abs(normal.y) > 0.9) baseColor = vec3(0.1, 0.2, 0.1); // 上下面は緑系
        else if(abs(normal.z) > 0.9) baseColor = vec3(0.1, 0.1, 0.2); // 前後面は青系
        
        // プリズム分光（角度で色分離）
        vec3 prismColor;
        float angle = dot(normal, vec3(1.0, 0.0, 0.0)) + angleOffset;
        prismColor.r = sin(angle * 3.0 + time + float(angleStep) * 0.5) * 0.5 + 0.5;
        prismColor.g = sin(angle * 3.0 + time + 2.094 + float(angleStep) * 0.5) * 0.5 + 0.5;
        prismColor.b = sin(angle * 3.0 + time + 4.189 + float(angleStep) * 0.5) * 0.5 + 0.5;
        
        // ダイヤモンドスパーク（角度で位置変化）
        float sparkle = 0.0;
        for(float i = 0.0; i < 3.0; i++) {
            vec3 sparkleNormal = normal + vec3(sin(i * 2.1 + angleOffset), cos(i * 2.1 + angleOffset), 0.0) * 0.1;
            float s = pow(max(dot(viewDir, reflect(-viewDir, sparkleNormal)), 0.0), 128.0);
            sparkle += s;
        }
        
        float intensity = 0.5 + abs(float(angleStep - 3)) * 0.2;
        
        vec3 finalColor = baseColor;
        finalColor += prismColor * intensity;
        finalColor += vec3(sparkle) * 2.0;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// エフェクト3: オーロラウェーブ
const fragmentShader3 = `
    uniform float time;
    uniform int angleStep;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        vec3 viewDir = normalize(vViewPosition);
        vec3 normal = normalize(vNormal);
        
        // 角度によるオーロラの波動変化
        float anglePhase = float(angleStep) * 0.5;
        
        // 立方体の世界座標を使った波動
        float wave1 = sin(vWorldPosition.x * 5.0 + time * 2.0 + anglePhase);
        float wave2 = sin(vWorldPosition.y * 4.0 - time * 1.5 + anglePhase);
        float wave3 = sin(vWorldPosition.z * 6.0 + time * 2.5 + anglePhase);
        float wavePattern = (wave1 + wave2 + wave3) / 3.0;
        
        // 角度による色相シフト
        float hueShift = time * 0.1 + float(angleStep) * 0.15 + wavePattern * 0.3;
        vec3 auroraColor1 = hsv2rgb(vec3(hueShift, 0.9, 1.0));
        vec3 auroraColor2 = hsv2rgb(vec3(hueShift + 0.3, 0.8, 1.0));
        
        // エッジグロー効果（角度で強度変化）
        float edgeGlow = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
        float intensity = 0.4 + abs(float(angleStep - 3)) * 0.1;
        
        vec3 finalColor = vec3(0.0, 0.05, 0.1);
        finalColor += mix(auroraColor1, auroraColor2, wavePattern * 0.5 + 0.5) * edgeGlow * intensity;
        finalColor += auroraColor1 * wavePattern * 0.3;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const fragmentShaders = [fragmentShader1, fragmentShader2, fragmentShader3];
const effectNames = ['ビックリマンホログラム', 'プリズムダイヤモンド', 'オーロラウェーブ'];

function init() {
    // シーンの作成
    scene = new THREE.Scene();
    
    // カメラの作成
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 4);
    
    // レンダラーの作成
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // 立方体の作成
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            angleStep: { value: currentAngleStep }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShaders[0]
    });
    
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // 環境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);
    
    // 指向性ライト
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // イベントリスナーの設定
    window.addEventListener('resize', onWindowResize);
    setupDeviceMotion();
    setupEffectButtons();
    updateAngleDisplay();
    
    // アニメーションループ開始
    animate();
}

function setupEffectButtons() {
    const effectButton = document.getElementById('effectButton');
    const effectName = document.getElementById('effectName');
    
    effectName.textContent = effectNames[currentEffectIndex];
    
    effectButton.addEventListener('click', () => {
        currentEffectIndex = (currentEffectIndex + 1) % fragmentShaders.length;
        effectName.textContent = effectNames[currentEffectIndex];
        
        // 新しいシェーダーでマテリアルを更新
        cube.material.fragmentShader = fragmentShaders[currentEffectIndex];
        cube.material.needsUpdate = true;
    });
}

function setupDeviceMotion() {
    if (window.DeviceOrientationEvent) {
        // iOS 13+ ではパーミッションが必要
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const button = document.querySelector('.effect-button');
            button.addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            window.addEventListener('deviceorientation', handleOrientation);
                        }
                    })
                    .catch(console.error);
            }, { once: true });
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
    }
    
    // マウスでのフォールバック（PC用）
    window.addEventListener('mousemove', handleMouseMove);
}

function handleOrientation(event) {
    const gamma = event.gamma || 0; // 左右: -90 to 90
    const beta = event.beta || 0;   // 前後: -180 to 180
    
    // 左右と前後を組み合わせた角度計算
    const combinedAngle = gamma + (beta > 90 || beta < -90 ? (beta > 0 ? beta - 180 : beta + 180) * 0.5 : beta * 0.5);
    
    // 7段階に分割
    let step = Math.floor((combinedAngle + 60) / 120 * 7);
    step = Math.max(0, Math.min(6, step));
    
    if(step !== currentAngleStep) {
        currentAngleStep = step;
        updateAngleDisplay();
        updateCubeRotation();
    }
}

function handleMouseMove(event) {
    const mouseX = (event.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
    const mouseY = (event.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
    
    // マウス位置を7段階に変換
    const combinedMouse = mouseX + mouseY * 0.5;
    let step = Math.floor((combinedMouse + 1) / 2 * 7);
    step = Math.max(0, Math.min(6, step));
    
    if(step !== currentAngleStep) {
        currentAngleStep = step;
        updateAngleDisplay();
        updateCubeRotation();
    }
}

function updateAngleDisplay() {
    const angleDisplay = document.getElementById('angleDisplay');
    const rotationDisplay = document.getElementById('rotationDisplay');
    const rotation = cubeRotations[currentAngleStep];
    const degrees = Math.round(rotation.y * 180 / Math.PI);
    
    angleDisplay.innerHTML = `角度: ${angleNames[currentAngleStep]}<br><div class="rotation-display">回転: ${degrees}°</div>`;
}

function updateCubeRotation() {
    // 立方体を7段階の角度にスナップ
    const targetRotation = cubeRotations[currentAngleStep];
    cube.rotation.set(targetRotation.x, targetRotation.y, 0);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // 基本的な浮遊アニメーション
    cube.position.y = Math.sin(Date.now() * 0.001) * 0.1;
    
    // uniform更新
    cube.material.uniforms.time.value = Date.now() * 0.001;
    cube.material.uniforms.angleStep.value = currentAngleStep;
    
    renderer.render(scene, camera);
}

// 初期化
init();