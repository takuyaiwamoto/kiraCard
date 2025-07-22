let scene, camera, renderer;
let hologramMaterial;
let imageTexture;
let tiltX = 0, tiltY = 0;
let targetTiltX = 0, targetTiltY = 0;
let currentEffectIndex = 0;
let mesh;

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

const fragmentShader1 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
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
        vec4 texColor = texture2D(tDiffuse, vUv);
        
        // 視線ベクトルの正規化
        vec3 viewDir = normalize(vViewPosition);
        
        // 傾きに基づく仮想光源の位置
        vec3 lightPos = vec3(tilt.x * 2.0, tilt.y * 2.0, 1.0);
        vec3 lightDir = normalize(lightPos);
        
        // Fresnel効果
        float fresnel = pow(1.0 - dot(viewDir, vNormal), 2.0);
        
        // 反射計算
        vec3 reflectDir = reflect(-lightDir, vNormal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        
        // ホログラム効果のための虹色グラデーション
        float angle = atan(tilt.y, tilt.x);
        float hue = angle / (2.0 * 3.14159) + 0.5;
        hue = fract(hue + time * 0.1);
        
        // 位置ベースのパターン
        vec2 pattern = vUv * 10.0 + tilt * 5.0;
        float wave = sin(pattern.x + time) * cos(pattern.y + time) * 0.5 + 0.5;
        
        // 虹色の生成
        vec3 rainbowColor = hsv2rgb(vec3(hue + wave * 0.2, 0.8, 1.0));
        
        // キラキラ効果
        vec2 sparkleCoord = vUv * 50.0 + tilt * 20.0;
        float sparkle = smoothstep(0.98, 1.0, sin(sparkleCoord.x + time * 3.0) * sin(sparkleCoord.y - time * 2.0));
        
        // 最終的な色の合成
        vec3 finalColor = texColor.rgb;
        finalColor += rainbowColor * fresnel * 0.5;
        finalColor += vec3(spec) * 0.8;
        finalColor += vec3(sparkle) * 2.0;
        
        // 傾きによる輝度調整
        float brightness = 1.0 + length(tilt) * 0.3;
        finalColor *= brightness;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// エフェクト2: プリズム分光効果
const fragmentShader2 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
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
        vec4 texColor = texture2D(tDiffuse, vUv);
        vec3 viewDir = normalize(vViewPosition);
        
        // プリズム効果の強度計算
        float prismStrength = length(tilt) * 0.03;
        
        // RGBチャンネルを分離してずらす
        vec2 redOffset = vUv + vec2(prismStrength * tilt.x, prismStrength * tilt.y);
        vec2 greenOffset = vUv;
        vec2 blueOffset = vUv - vec2(prismStrength * tilt.x, prismStrength * tilt.y);
        
        vec3 chromatic;
        chromatic.r = texture2D(tDiffuse, redOffset).r;
        chromatic.g = texture2D(tDiffuse, greenOffset).g;
        chromatic.b = texture2D(tDiffuse, blueOffset).b;
        
        // 光沢のストライプパターン
        float stripePattern = sin((vUv.x - vUv.y) * 30.0 + tilt.x * 10.0 + time * 2.0) * 0.5 + 0.5;
        float gloss = smoothstep(0.7, 0.9, stripePattern) * abs(tilt.x + tilt.y);
        
        // ダイヤモンドのような点滅
        vec2 sparklePos = vUv * 20.0;
        float diamondSparkle = 0.0;
        for(float i = 0.0; i < 3.0; i++) {
            vec2 offset = vec2(sin(i * 2.1), cos(i * 2.1)) * 0.1;
            vec2 p = sparklePos + offset + tilt * 10.0;
            float spark = smoothstep(0.99, 1.0, sin(p.x + time * 5.0) * sin(p.y - time * 3.0));
            diamondSparkle += spark;
        }
        
        vec3 finalColor = chromatic;
        finalColor += vec3(gloss) * 0.5;
        finalColor += vec3(diamondSparkle) * 1.5;
        
        // 全体的な明度調整
        finalColor *= 1.0 + length(tilt) * 0.4;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// エフェクト3: オーロラ波動効果
const fragmentShader3 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    float noise(vec2 p) {
        return sin(p.x * 10.0) * sin(p.y * 10.0);
    }
    
    void main() {
        vec4 texColor = texture2D(tDiffuse, vUv);
        vec3 viewDir = normalize(vViewPosition);
        
        // オーロラのような波動パターン
        vec2 waveCoord = vUv + tilt * 0.3;
        float wave1 = sin(waveCoord.x * 15.0 + time * 2.0 + tilt.x * 5.0) * 0.5 + 0.5;
        float wave2 = sin(waveCoord.y * 12.0 - time * 1.5 + tilt.y * 5.0) * 0.5 + 0.5;
        float wave3 = sin(length(waveCoord - 0.5) * 20.0 - time * 3.0) * 0.5 + 0.5;
        
        float wavePattern = wave1 * wave2 * wave3;
        
        // 動的な色相シフト
        float hueShift = time * 0.2 + length(tilt) * 0.5 + wavePattern * 0.3;
        vec3 auroraColor1 = hsv2rgb(vec3(hueShift, 0.9, 1.0));
        vec3 auroraColor2 = hsv2rgb(vec3(hueShift + 0.3, 0.8, 1.0));
        vec3 auroraColor3 = hsv2rgb(vec3(hueShift + 0.6, 0.7, 1.0));
        
        // レイヤー効果
        vec3 layer1 = auroraColor1 * smoothstep(0.3, 0.7, wavePattern);
        vec3 layer2 = auroraColor2 * smoothstep(0.5, 0.9, wave1 * wave2);
        vec3 layer3 = auroraColor3 * smoothstep(0.4, 0.8, wave3);
        
        // 流れるような光の筋
        float flow = sin(vUv.x * 30.0 + vUv.y * 20.0 - time * 4.0 + tilt.x * 10.0);
        float flowMask = smoothstep(0.8, 1.0, flow) * (0.5 + 0.5 * sin(time * 5.0));
        
        vec3 finalColor = texColor.rgb;
        finalColor += (layer1 + layer2 + layer3) * 0.4 * (0.5 + length(tilt));
        finalColor += vec3(flowMask) * 1.2;
        
        // 明度とコントラスト調整
        finalColor = mix(texColor.rgb, finalColor, 0.7);
        finalColor *= 1.0 + length(tilt) * 0.5;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// エフェクト4: ビックリマン風ホログラム
const fragmentShader4 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
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
        vec4 texColor = texture2D(tDiffuse, vUv);
        vec3 viewDir = normalize(vViewPosition);
        
        // ビックリマン特有の放射状パターン
        vec2 center = vec2(0.5, 0.5);
        vec2 toCenter = vUv - center;
        float angle = atan(toCenter.y, toCenter.x);
        float radius = length(toCenter);
        
        // 放射状の虹色ストライプ（ビックリマンの特徴）
        float stripeCount = 24.0; // 放射状のストライプ数
        float stripeAngle = angle * stripeCount / (2.0 * 3.14159);
        float stripe = fract(stripeAngle + tilt.x * 2.0);
        
        // 同心円パターン
        float ringCount = 8.0;
        float ring = fract(radius * ringCount - time * 0.5 + tilt.y);
        
        // ビックリマン特有の虹色グラデーション
        float hue1 = fract(stripe * 0.15 + time * 0.05 + tilt.x * 0.3);
        float hue2 = fract(ring * 0.2 + time * 0.03 + tilt.y * 0.3);
        
        vec3 color1 = hsv2rgb(vec3(hue1, 0.9, 1.0));
        vec3 color2 = hsv2rgb(vec3(hue2, 0.8, 1.0));
        
        // 強い金属光沢（ビックリマンシールの特徴）
        float metallic = pow(stripe, 2.0) * pow(ring, 2.0);
        vec3 metallicColor = mix(vec3(1.0, 0.9, 0.5), vec3(1.0, 1.0, 1.0), metallic);
        
        // スターバースト効果（中心から放射される光）
        float burst = 0.0;
        for(float i = 0.0; i < 6.0; i++) {
            float burstAngle = i * 3.14159 / 3.0 + time * 0.5;
            vec2 burstDir = vec2(cos(burstAngle), sin(burstAngle));
            float burstDot = abs(dot(normalize(toCenter), burstDir));
            burst += pow(burstDot, 20.0) * (1.0 - radius);
        }
        
        // キラキラ粒子（ビックリマンの特徴的な輝き）
        vec2 sparkleGrid = vUv * 30.0;
        vec2 sparkleId = floor(sparkleGrid);
        float sparkleRand = fract(sin(dot(sparkleId, vec2(12.9898, 78.233))) * 43758.5453);
        float sparklePhase = sparkleRand + time * 2.0;
        float sparkle = smoothstep(0.95, 1.0, sin(sparklePhase) * sin(sparklePhase * 1.3));
        sparkle *= step(0.7, sparkleRand); // 一部の粒子のみキラキラ
        
        // 傾きによる反射の変化（ビックリマンを傾けた時の効果）
        float tiltEffect = abs(sin(angle + tilt.x * 3.0)) * abs(cos(radius * 10.0 + tilt.y * 3.0));
        
        // 最終的な色の合成
        vec3 finalColor = texColor.rgb;
        
        // 放射状虹色レイヤー（透明度を上げて背景が見えるように）
        finalColor = mix(finalColor, color1, stripe * 0.3 * (0.5 + tiltEffect * 0.5));
        
        // 同心円レイヤー
        finalColor = mix(finalColor, color2, ring * 0.2);
        
        // 金属光沢（弱める）
        finalColor += metallicColor * metallic * 0.3;
        
        // スターバースト（弱める）
        finalColor += vec3(burst) * 0.6;
        
        // キラキラ粒子（弱める）
        finalColor += vec3(sparkle) * 0.8;
        
        // 全体的な輝度調整（傾けるとより輝く）
        float brightness = 1.0 + length(tilt) * 0.3;
        finalColor *= brightness;
        
        // コントラスト調整（より自然に）
        finalColor = pow(finalColor, vec3(0.95));
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

const fragmentShaders = [fragmentShader1, fragmentShader2, fragmentShader3, fragmentShader4];
const effectNames = ['レインボーホログラム', 'プリズムダイヤモンド', 'オーロラウェーブ', 'ビックリマンホログラム'];

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
    hologramMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: imageTexture },
            time: { value: 0 },
            tilt: { value: new THREE.Vector2(0, 0) },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShaders[0],
        side: THREE.DoubleSide
    });
    
    // 平面ジオメトリの作成
    const geometry = new THREE.PlaneGeometry(4, 4, 32, 32);
    mesh = new THREE.Mesh(geometry, hologramMaterial);
    scene.add(mesh);
    
    // イベントリスナーの設定
    window.addEventListener('resize', onWindowResize);
    setupDeviceMotion();
    setupFileUpload();
    setupEffectButtons();
    
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
        hologramMaterial.fragmentShader = fragmentShaders[currentEffectIndex];
        hologramMaterial.needsUpdate = true;
    });
}

function createDefaultTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // グラデーション背景
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#ff006e');
    gradient.addColorStop(0.5, '#8338ec');
    gradient.addColorStop(1, '#3a86ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // テキスト
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLOGRAM', 256, 200);
    ctx.font = '24px Arial';
    ctx.fillText('画像をアップロードしてください', 256, 300);
    
    imageTexture = new THREE.CanvasTexture(canvas);
}

function setupDeviceMotion() {
    if (window.DeviceOrientationEvent) {
        // iOS 13+ ではパーミッションが必要
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // ユーザーインタラクションが必要なので、ボタンクリック時に実行
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
    // beta: -180 to 180 (前後の傾き)
    // gamma: -90 to 90 (左右の傾き)
    targetTiltX = (event.gamma || 0) / 90;
    targetTiltY = (event.beta || 0) / 180;
    
    // 範囲制限
    targetTiltX = Math.max(-1, Math.min(1, targetTiltX));
    targetTiltY = Math.max(-1, Math.min(1, targetTiltY));
}

function handleMouseMove(event) {
    // PCでのマウス操作でも動作確認できるように
    targetTiltX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetTiltY = (event.clientY / window.innerHeight - 0.5) * 2;
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
            hologramMaterial.uniforms.tDiffuse.value = texture;
            loading.style.display = 'none';
        });
    };
    
    reader.readAsDataURL(file);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    hologramMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // スムーズな傾き遷移
    tiltX += (targetTiltX - tiltX) * 0.1;
    tiltY += (targetTiltY - tiltY) * 0.1;
    
    // uniform更新
    hologramMaterial.uniforms.time.value += 0.01;
    hologramMaterial.uniforms.tilt.value.set(tiltX, tiltY);
    
    renderer.render(scene, camera);
}

// 初期化
init();