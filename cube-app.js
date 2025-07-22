let scene, camera, renderer;
let cube;
let currentEffectIndex = 0;
let tiltX = 0, tiltY = 0;
let targetTiltX = 0, targetTiltY = 0;

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

// エフェクト1: レインボーホログラム
const fragmentShader1 = `
    uniform float time;
    uniform vec2 tilt;
    
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
        
        // Fresnel効果
        float fresnel = pow(1.0 - dot(viewDir, vNormal), 1.5);
        
        // 虹色グラデーション
        float hue = dot(vNormal, vec3(tilt.x, tilt.y, 1.0)) * 0.5 + 0.5;
        hue = fract(hue + time * 0.1);
        vec3 rainbowColor = hsv2rgb(vec3(hue, 0.8, 1.0));
        
        // キラキラ効果
        vec2 sparkleCoord = vUv * 20.0 + tilt * 10.0;
        float sparkle = smoothstep(0.98, 1.0, sin(sparkleCoord.x + time * 3.0) * sin(sparkleCoord.y - time * 2.0));
        
        vec3 finalColor = vec3(0.1, 0.1, 0.2); // ベースカラー
        finalColor += rainbowColor * fresnel;
        finalColor += vec3(sparkle) * 2.0;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// エフェクト2: プリズムダイヤモンド
const fragmentShader2 = `
    uniform float time;
    uniform vec2 tilt;
    
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
        
        // ダイヤモンドのような反射
        vec3 reflectDir = reflect(-viewDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);
        
        // プリズム分光
        vec3 prismColor;
        float angle = dot(normal, vec3(tilt.x, tilt.y, 1.0));
        prismColor.r = sin(angle * 3.0 + time) * 0.5 + 0.5;
        prismColor.g = sin(angle * 3.0 + time + 2.094) * 0.5 + 0.5;
        prismColor.b = sin(angle * 3.0 + time + 4.189) * 0.5 + 0.5;
        
        // ダイヤモンドスパーク
        float sparkle = 0.0;
        for(float i = 0.0; i < 3.0; i++) {
            vec3 sparkleNormal = normal + vec3(sin(i * 2.1), cos(i * 2.1), 0.0) * 0.1;
            float s = pow(max(dot(viewDir, reflect(-viewDir, sparkleNormal)), 0.0), 128.0);
            sparkle += s;
        }
        
        vec3 finalColor = vec3(0.05, 0.05, 0.1);
        finalColor += prismColor * 0.5;
        finalColor += vec3(spec) * 2.0;
        finalColor += vec3(sparkle) * 3.0;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// エフェクト3: オーロラウェーブ
const fragmentShader3 = `
    uniform float time;
    uniform vec2 tilt;
    
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
        
        // オーロラ波動
        float wave1 = sin(vWorldPosition.x * 5.0 + time * 2.0 + tilt.x * 3.0);
        float wave2 = sin(vWorldPosition.y * 4.0 - time * 1.5 + tilt.y * 3.0);
        float wave3 = sin(vWorldPosition.z * 6.0 + time * 2.5);
        float wavePattern = (wave1 + wave2 + wave3) / 3.0;
        
        // 動的な色相
        float hueShift = time * 0.1 + wavePattern * 0.3 + length(tilt) * 0.5;
        vec3 auroraColor1 = hsv2rgb(vec3(hueShift, 0.9, 1.0));
        vec3 auroraColor2 = hsv2rgb(vec3(hueShift + 0.3, 0.8, 1.0));
        
        // エッジグロー効果
        float edgeGlow = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
        
        vec3 finalColor = vec3(0.0, 0.05, 0.1);
        finalColor += mix(auroraColor1, auroraColor2, wavePattern * 0.5 + 0.5) * edgeGlow;
        finalColor += auroraColor1 * wavePattern * 0.3;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// エフェクト4: ビックリマンホログラム
const fragmentShader4 = `
    uniform float time;
    uniform vec2 tilt;
    
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
        
        // 立方体の面ごとに異なるパターン
        float facePattern = 0.0;
        if(abs(normal.x) > 0.9) facePattern = 1.0;
        else if(abs(normal.y) > 0.9) facePattern = 2.0;
        else if(abs(normal.z) > 0.9) facePattern = 3.0;
        
        // 放射状パターン（面ごとに異なる）
        vec2 faceUV = vUv - 0.5;
        float angle = atan(faceUV.y, faceUV.x) + facePattern;
        float radius = length(faceUV);
        
        // 放射状虹色
        float stripeCount = 12.0;
        float stripe = fract(angle * stripeCount / (2.0 * 3.14159) + tilt.x + time * 0.1);
        
        // ビックリマン特有の色
        float hue = stripe * 0.2 + facePattern * 0.15 + time * 0.05;
        vec3 hologramColor = hsv2rgb(vec3(hue, 0.9, 1.0));
        
        // 金属光沢
        float metallic = pow(stripe, 3.0);
        vec3 metallicColor = mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 1.0, 1.0), metallic);
        
        // スターバースト（各面の中心から）
        float burst = 0.0;
        for(float i = 0.0; i < 4.0; i++) {
            float burstAngle = i * 3.14159 / 2.0 + time * 0.5 + facePattern;
            vec2 burstDir = vec2(cos(burstAngle), sin(burstAngle));
            float burstDot = abs(dot(normalize(faceUV), burstDir));
            burst += pow(burstDot, 30.0) * (1.0 - radius * 2.0);
        }
        
        // キラキラ粒子
        vec2 sparklePos = vUv * 15.0;
        float sparkle = smoothstep(0.98, 1.0, sin(sparklePos.x * facePattern + time * 5.0) * sin(sparklePos.y - time * 3.0));
        
        vec3 finalColor = vec3(0.1, 0.05, 0.15);
        finalColor += hologramColor * 0.6;
        finalColor += metallicColor * metallic * 0.5;
        finalColor += vec3(burst) * 2.0;
        finalColor += vec3(sparkle) * 3.0;
        
        // 傾きによる輝度変化
        finalColor *= 1.0 + length(tilt) * 0.5;
        
        gl_FragColor = vec4(finalColor, 1.0);
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
    camera.position.z = 3;
    
    // レンダラーの作成
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // 立方体の作成
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            tilt: { value: new THREE.Vector2(0, 0) }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShaders[0]
    });
    
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // 環境光
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    // イベントリスナーの設定
    window.addEventListener('resize', onWindowResize);
    setupDeviceMotion();
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

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // スムーズな傾き遷移
    tiltX += (targetTiltX - tiltX) * 0.1;
    tiltY += (targetTiltY - tiltY) * 0.1;
    
    // 立方体の回転（基本的な回転 + 傾きによる追加回転）
    cube.rotation.x = Date.now() * 0.0005 + tiltY * 0.5;
    cube.rotation.y = Date.now() * 0.0007 + tiltX * 0.5;
    
    // 傾きによるカメラ位置の微調整（視差効果）
    camera.position.x = tiltX * 0.3;
    camera.position.y = -tiltY * 0.3;
    camera.lookAt(0, 0, 0);
    
    // uniform更新
    cube.material.uniforms.time.value = Date.now() * 0.001;
    cube.material.uniforms.tilt.value.set(tiltX, tiltY);
    
    renderer.render(scene, camera);
}

// 初期化
init();