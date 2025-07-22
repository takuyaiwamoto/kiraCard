let scene, camera, renderer;
let planeMaterial;
let imageTexture;
let currentAngleStep = 3; // 0-6の7段階、3が中央
let currentEffectIndex = 0;
let mesh;

// 7段階の角度名
const angleNames = ['左々', '左+', '左', '中央', '右', '右+', '右々'];

const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// レンチキュラー効果1: ビックリマンホログラム
const fragmentShader1 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform int angleStep; // 0-6の7段階
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        // 7段階に対応したUVオフセット計算
        float stepOffset = float(angleStep - 3) * 0.05; // -3から+3の範囲を-0.15から+0.15にマッピング
        
        // 画像の異なる部分を表示（左右にスライド）
        vec2 shiftedUV = vUv + vec2(stepOffset, 0.0);
        
        // UV範囲を0-1に正規化（ラップアラウンド）
        shiftedUV.x = fract(shiftedUV.x);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        vec3 viewDir = normalize(vViewPosition);
        
        // ビックリマン特有の放射状パターン（角度ステップで変化）
        vec2 center = vec2(0.5, 0.5);
        vec2 toCenter = vUv - center;
        float angle = atan(toCenter.y, toCenter.x);
        float radius = length(toCenter);
        
        // 角度ステップによって放射パターンが回転
        float rotationOffset = float(angleStep) * 0.52; // 約30度ずつ回転
        
        // 放射状の虹色ストライプ
        float stripeCount = 24.0;
        float stripeAngle = (angle + rotationOffset) * stripeCount / (2.0 * 3.14159);
        float stripe = fract(stripeAngle + time * 0.1);
        
        // 同心円パターン（角度で位相がずれる）
        float ringCount = 8.0;
        float ring = fract(radius * ringCount - time * 0.5 + float(angleStep) * 0.2);
        
        // 角度ステップによる色相シフト
        float hueShift = float(angleStep) * 0.14; // 各ステップで色相が変化
        float hue1 = fract(stripe * 0.15 + time * 0.05 + hueShift);
        float hue2 = fract(ring * 0.2 + time * 0.03 + hueShift);
        
        vec3 color1 = hsv2rgb(vec3(hue1, 0.9, 1.0));
        vec3 color2 = hsv2rgb(vec3(hue2, 0.8, 1.0));
        
        // 金属光沢（角度で強度変化）
        float metallic = pow(stripe, 2.0) * pow(ring, 2.0);
        float metallicIntensity = 0.3 + abs(float(angleStep - 3)) * 0.1; // 中央から離れるほど強く
        vec3 metallicColor = mix(vec3(1.0, 0.9, 0.5), vec3(1.0, 1.0, 1.0), metallic);
        
        // スターバースト効果（角度で向きが変わる）
        float burst = 0.0;
        for(float i = 0.0; i < 6.0; i++) {
            float burstAngle = i * 3.14159 / 3.0 + time * 0.5 + rotationOffset;
            vec2 burstDir = vec2(cos(burstAngle), sin(burstAngle));
            float burstDot = abs(dot(normalize(toCenter), burstDir));
            burst += pow(burstDot, 20.0) * (1.0 - radius);
        }
        
        // キラキラ粒子（角度で密度変化）
        vec2 sparkleGrid = vUv * (30.0 + float(angleStep) * 2.0);
        vec2 sparkleId = floor(sparkleGrid);
        float sparkleRand = fract(sin(dot(sparkleId, vec2(12.9898, 78.233))) * 43758.5453);
        float sparklePhase = sparkleRand + time * 2.0 + float(angleStep) * 0.5;
        float sparkle = smoothstep(0.95, 1.0, sin(sparklePhase) * sin(sparklePhase * 1.3));
        sparkle *= step(0.7, sparkleRand);
        
        // 傾きによる反射の変化
        float angleFactor = abs(float(angleStep - 3)) / 3.0; // 0-1の範囲
        float tiltEffect = sin(angle + rotationOffset) * cos(radius * 10.0);
        
        // 最終的な色の合成
        vec3 finalColor = texColor.rgb;
        
        // 放射状虹色レイヤー（角度で強度変化）
        finalColor = mix(finalColor, color1, stripe * 0.3 * (0.5 + abs(tiltEffect) * 0.5));
        
        // 同心円レイヤー
        finalColor = mix(finalColor, color2, ring * 0.2);
        
        // 金属光沢
        finalColor += metallicColor * metallic * metallicIntensity;
        
        // スターバースト
        finalColor += vec3(burst) * (0.6 + angleFactor * 0.4);
        
        // キラキラ粒子
        finalColor += vec3(sparkle) * (0.8 + angleFactor * 0.8);
        
        // 角度による全体的な輝度調整
        float brightness = 1.0 + angleFactor * 0.3;
        finalColor *= brightness;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// レンチキュラー効果2: プリズム分光
const fragmentShader2 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform int angleStep;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
        // 7段階に対応したUVオフセット計算
        float stepOffset = float(angleStep - 3) * 0.05;
        vec2 shiftedUV = vUv + vec2(stepOffset, 0.0);
        shiftedUV.x = fract(shiftedUV.x);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        vec3 viewDir = normalize(vViewPosition);
        vec3 normal = normalize(vNormal);
        
        // 角度ステップによるプリズム効果の強度
        float prismStrength = 0.02 + abs(float(angleStep - 3)) * 0.01;
        
        // RGBチャンネル分離（角度で方向変化）
        float angleOffset = float(angleStep - 3) * 0.3;
        vec2 redOffset = shiftedUV + vec2(prismStrength * cos(angleOffset), prismStrength * sin(angleOffset));
        vec2 greenOffset = shiftedUV;
        vec2 blueOffset = shiftedUV - vec2(prismStrength * cos(angleOffset), prismStrength * sin(angleOffset));
        
        vec3 chromatic;
        chromatic.r = texture2D(tDiffuse, redOffset).r;
        chromatic.g = texture2D(tDiffuse, greenOffset).g;
        chromatic.b = texture2D(tDiffuse, blueOffset).b;
        
        // 角度による光沢パターン
        float angleRadians = float(angleStep) * 0.52;
        float stripePattern = sin((vUv.x - vUv.y) * 30.0 + angleRadians + time * 2.0) * 0.5 + 0.5;
        float gloss = smoothstep(0.7, 0.9, stripePattern) * (0.5 + abs(float(angleStep - 3)) * 0.2);
        
        // ダイヤモンドスパーク（角度で位置変化）
        vec2 sparklePos = vUv * 20.0 + vec2(angleOffset, 0.0);
        float diamondSparkle = 0.0;
        for(float i = 0.0; i < 3.0; i++) {
            vec2 offset = vec2(sin(i * 2.1 + angleOffset), cos(i * 2.1 + angleOffset)) * 0.1;
            vec2 p = sparklePos + offset;
            float spark = smoothstep(0.99, 1.0, sin(p.x + time * 5.0) * sin(p.y - time * 3.0));
            diamondSparkle += spark;
        }
        
        vec3 finalColor = chromatic;
        finalColor += vec3(gloss) * 0.5;
        finalColor += vec3(diamondSparkle) * 1.5;
        
        // 角度による明度調整
        float brightness = 1.0 + abs(float(angleStep - 3)) * 0.1;
        finalColor *= brightness;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// レンチキュラー効果3: オーロラウェーブ
const fragmentShader3 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform int angleStep;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        float stepOffset = float(angleStep - 3) * 0.05;
        vec2 shiftedUV = vUv + vec2(stepOffset, 0.0);
        shiftedUV.x = fract(shiftedUV.x);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        vec3 viewDir = normalize(vViewPosition);
        
        // 角度によるオーロラの波動変化
        float anglePhase = float(angleStep) * 0.5;
        vec2 waveCoord = vUv + vec2(stepOffset, 0.0);
        
        float wave1 = sin(waveCoord.x * 15.0 + time * 2.0 + anglePhase);
        float wave2 = sin(waveCoord.y * 12.0 - time * 1.5 + anglePhase);
        float wave3 = sin(length(waveCoord - 0.5) * 20.0 - time * 3.0 + anglePhase);
        
        float wavePattern = (wave1 + wave2 + wave3) / 3.0;
        
        // 角度による色相シフト
        float hueShift = time * 0.2 + float(angleStep) * 0.15 + wavePattern * 0.3;
        vec3 auroraColor1 = hsv2rgb(vec3(hueShift, 0.9, 1.0));
        vec3 auroraColor2 = hsv2rgb(vec3(hueShift + 0.3, 0.8, 1.0));
        vec3 auroraColor3 = hsv2rgb(vec3(hueShift + 0.6, 0.7, 1.0));
        
        // レイヤー効果（角度で強度変化）
        float intensity = 0.4 + abs(float(angleStep - 3)) * 0.1;
        vec3 layer1 = auroraColor1 * smoothstep(0.3, 0.7, wavePattern) * intensity;
        vec3 layer2 = auroraColor2 * smoothstep(0.5, 0.9, wave1 * wave2) * intensity;
        vec3 layer3 = auroraColor3 * smoothstep(0.4, 0.8, wave3) * intensity;
        
        // 流れるような光の筋（角度で方向変化）
        float flowAngle = float(angleStep - 3) * 0.3;
        float flow = sin(vUv.x * 30.0 * cos(flowAngle) + vUv.y * 20.0 * sin(flowAngle) - time * 4.0);
        float flowMask = smoothstep(0.8, 1.0, flow) * (0.5 + 0.5 * sin(time * 5.0));
        
        vec3 finalColor = texColor.rgb;
        finalColor += (layer1 + layer2 + layer3);
        finalColor += vec3(flowMask) * 1.2;
        
        // 明度とコントラスト調整
        finalColor = mix(texColor.rgb, finalColor, 0.7);
        finalColor *= 1.0 + abs(float(angleStep - 3)) * 0.1;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

const fragmentShaders = [fragmentShader1, fragmentShader2, fragmentShader3];
const effectNames = ['ビックリマンホログラム', 'プリズムダイヤモンド', 'オーロラウェーブ'];

function init() {
    // シーンの作成
    scene = new THREE.Scene();
    
    // カメラの作成
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;
    
    // レンダラーの作成
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // デフォルトテクスチャの作成
    createDefaultTexture();
    
    // マテリアルの作成
    planeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: imageTexture },
            time: { value: 0 },
            angleStep: { value: currentAngleStep },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShaders[0],
        side: THREE.DoubleSide
    });
    
    // 平面ジオメトリの作成
    const geometry = new THREE.PlaneGeometry(4, 4, 32, 32);
    mesh = new THREE.Mesh(geometry, planeMaterial);
    scene.add(mesh);
    
    // イベントリスナーの設定
    window.addEventListener('resize', onWindowResize);
    setupDeviceMotion();
    setupFileUpload();
    setupEffectButtons();
    
    // アニメーションループ開始
    animate();
}

function createDefaultTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // 7段階表示用のグラデーション背景
    for(let i = 0; i < 7; i++) {
        const x = i * 73; // 512/7 ≈ 73
        const hue = i * 60; // 0, 60, 120, 180, 240, 300, 360
        ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
        ctx.fillRect(x, 0, 73, 512);
        
        // 各セクションにテキスト
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(angleNames[i], x + 36, 256);
    }
    
    // 中央にタイトル
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 200, 512, 112);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LENTICULAR', 256, 240);
    ctx.font = '18px Arial';
    ctx.fillText('7段階ホログラム', 256, 280);
    
    imageTexture = new THREE.CanvasTexture(canvas);
}

function setupDeviceMotion() {
    if (window.DeviceOrientationEvent) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const button = document.querySelector('.upload-button');
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
    // 左右の傾きと前後の傾きを組み合わせて7段階判定
    const gamma = event.gamma || 0; // 左右: -90 to 90
    const beta = event.beta || 0;   // 前後: -180 to 180
    
    // 左右と前後を組み合わせた角度計算
    const combinedAngle = gamma + (beta > 90 || beta < -90 ? (beta > 0 ? beta - 180 : beta + 180) * 0.5 : beta * 0.5);
    
    // 7段階に分割（-60度から+60度を7段階に）
    let step = Math.floor((combinedAngle + 60) / 120 * 7);
    step = Math.max(0, Math.min(6, step));
    
    if(step !== currentAngleStep) {
        currentAngleStep = step;
        updateAngleDisplay();
    }
}

function handleMouseMove(event) {
    // PCでのマウス操作でも動作確認できるように
    const mouseX = (event.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
    const mouseY = (event.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
    
    // マウス位置を7段階に変換
    const combinedMouse = mouseX + mouseY * 0.5;
    let step = Math.floor((combinedMouse + 1) / 2 * 7);
    step = Math.max(0, Math.min(6, step));
    
    if(step !== currentAngleStep) {
        currentAngleStep = step;
        updateAngleDisplay();
    }
}

function updateAngleDisplay() {
    const angleDisplay = document.getElementById('angleDisplay');
    angleDisplay.textContent = `角度: ${angleNames[currentAngleStep]}`;
}

function setupEffectButtons() {
    const effectButton = document.getElementById('effectButton');
    const effectName = document.getElementById('effectName');
    
    effectName.textContent = effectNames[currentEffectIndex];
    
    effectButton.addEventListener('click', () => {
        currentEffectIndex = (currentEffectIndex + 1) % fragmentShaders.length;
        effectName.textContent = effectNames[currentEffectIndex];
        
        // 新しいシェーダーでマテリアルを更新
        planeMaterial.fragmentShader = fragmentShaders[currentEffectIndex];
        planeMaterial.needsUpdate = true;
    });
}

function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileUpload);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    const loading = document.getElementById('loading');
    
    loading.style.display = 'block';
    
    reader.onload = function(e) {
        const loader = new THREE.TextureLoader();
        loader.load(e.target.result, function(texture) {
            imageTexture = texture;
            planeMaterial.uniforms.tDiffuse.value = texture;
            loading.style.display = 'none';
        });
    };
    
    reader.readAsDataURL(file);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    planeMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // uniform更新
    planeMaterial.uniforms.time.value += 0.01;
    planeMaterial.uniforms.angleStep.value = currentAngleStep;
    
    renderer.render(scene, camera);
}

// 初期化
init();