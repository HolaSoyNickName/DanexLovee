import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

const accentColors = {
  rose: 0xed8b98,
  violet: 0xa591c7,
  blue: 0x7998db,
  sunshine: 0xe7bd62,
};

const galleryItems = [
  {
    src: "https://bcodestorague.anteroteobaldob.workers.dev/share/anteroteobaldob_gmail_com/GIF/gatito.gif",
    alt: "Un gatito con un mensaje de amor",
    message: "Eres la luz que ilumina mi vida cada día.",
  },
  {
    src: "https://bcodestorague.anteroteobaldob.workers.dev/share/anteroteobaldob_gmail_com/GIF/img.gif",
    alt: "Un recuerdo para compartir",
    message: "Cada momento a tu lado es un regalo del universo.",
  },
  {
    src: "https://bcodestorague.anteroteobaldob.workers.dev/share/anteroteobaldob_gmail_com/GIF/Gatitosi.gif",
    alt: "Dos gatitos juntos",
    message: "Tu sonrisa es mi mayor tesoro.",
  },
  {
    src: "https://bcodestorague.anteroteobaldob.workers.dev/share/anteroteobaldob_gmail_com/GIF/Gatito1.gif",
    alt: "Un gatito enamorado",
    message: "Contigo he encontrado el amor verdadero",
  },
];

const loveMessages = ["TE AMOO", "TE QUIERO", "MI REINA", "MI AMOR", "ERES ÚNICA", "PARA SIEMPRE", "MI VIDA", "MI CORAZÓN", "MI ALMA", "MI LUZ", "MI RAZÓN", "MI FELICIDAD", "MI SUEÑO", "MI DESEO", "MI PASIÓN", "MI TESORO", "MI ÁNGEL", "MI SOL", "MI ESTRELLA", "MI DESTINO", "MI SUERTE", "MI COMPAÑERA", "MI AMIGA", "MI APOYO", "MI REFUGIO", "MI PAZ", "MI CALMA", "MI FUERZA", "MI DEBILIDAD", "MI SONRISA", "MI RISITA", "MI LOCURA", "MI SERENIDAD", "MI EQUILIBRIO", "MI COMPLEMENTO", "MI NARANJA", "MI GEMELA", "MI TODO", "MI ETERNA", "MI INFINITO", "MI PRESENTE", "MI FUTURO", "MI PASADO", "MI HOY", "MI MAÑANA", "MI SIEMPRE", "MI NUNCA", "MI AHORA"];
const tapMessages = ["Mi corazón late por ti", "Eres mi sueño hecho realidad", "Eres mi todo", "Te amo más cada día", "Eres mi razón de ser"];
const planetTextureUrl = "https://bcodestorague.anteroteobaldob.workers.dev/share/anteroteobaldob_gmail_com/TEXTURAS/textura_sat.jpg";

function createSaturnTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const base = context.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "#d7b18a");
  base.addColorStop(0.28, "#b98665");
  base.addColorStop(0.52, "#e5c29b");
  base.addColorStop(0.72, "#a8785d");
  base.addColorStop(1, "#d5ae84");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const bands = [
    [38, 18, "#f1d9b8"], [91, 22, "#9d6e58"], [145, 13, "#d5ad84"],
    [204, 27, "#815e53"], [268, 20, "#edcfaa"], [324, 14, "#a8785e"],
    [390, 24, "#e6c49c"], [452, 17, "#8e6858"],
  ];
  bands.forEach(([top, height, color]) => {
    context.fillStyle = color;
    context.globalAlpha = 0.48;
    context.fillRect(0, top, canvas.width, height);
  });
  context.globalAlpha = 1;
  for (let index = 0; index < 85; index += 1) {
    const y = Math.random() * canvas.height;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(300, y + Math.random() * 20 - 10, 700, y + Math.random() * 20 - 10, canvas.width, y);
    context.strokeStyle = index % 3 ? "rgba(255, 239, 210, .12)" : "rgba(73, 44, 39, .12)";
    context.lineWidth = 1 + Math.random() * 4;
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMessageSprite(message, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  context.font = "600 34px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.fillText(message.slice(0, 38).toLocaleUpperCase("es-MX"), canvas.width / 2, canvas.height / 2, 490);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.8, 1.08, 1);
  return sprite;
}

function disposeMaterial(material) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => {
    if (!item) return;
    Object.values(item).forEach((value) => {
      if (value?.isTexture) value.dispose();
    });
    item.dispose();
  });
}

export default function GalaxyExperience({ experience }) {
  const mountRef = useRef(null);
  const audioRef = useRef(null);
  const sceneRef = useRef(null);
  const fallingHeartsRef = useRef([]);
  const heartTimerRef = useRef(null);
  const [audioOn, setAudioOn] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [tapMessage, setTapMessage] = useState("");
  const [tapCount, setTapCount] = useState(0);
  const [explosion, setExplosion] = useState(null);
  const [hearts, setHearts] = useState([]);
  const { content, template } = experience;
  const accent = accentColors[content.accentColor] ?? accentColors.rose;
  const accentHex = `#${accent.toString(16).padStart(6, "0")}`;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    let controls;
    let frameId;
    let resizeObserver;
    let scene;

    try {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.fog = new THREE.FogExp2(0x03040b, 0.006);

      const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 700);
      camera.position.set(0, 7, 24);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      mount.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight(0x8184bd, 1.15);
      scene.add(ambient);
      const keyLight = new THREE.PointLight(accent, 95, 72);
      keyLight.position.set(-10, 8, 15);
      scene.add(keyLight);
      const warmLight = new THREE.PointLight(0xffc99a, 52, 55);
      warmLight.position.set(8, -5, -9);
      scene.add(warmLight);

      const planetGroup = new THREE.Group();
      planetGroup.rotation.z = 0.12;
      scene.add(planetGroup);

      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(4.1, 96, 72),
        new THREE.MeshStandardMaterial({ map: createSaturnTexture(), roughness: 0.94, metalness: 0.02 }),
      );
      planet.rotation.z = 0.18;
      planetGroup.add(planet);
      new THREE.TextureLoader().load(planetTextureUrl, (texture) => {
        if (!mount.isConnected) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        planet.material.map = texture;
        planet.material.needsUpdate = true;
      });

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 48, 48),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.08, side: THREE.BackSide }),
      );
      planetGroup.add(atmosphere);

      const ringBack = new THREE.Mesh(
        new THREE.RingGeometry(5.2, 8.3, 180),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).multiplyScalar(0.68), transparent: true, opacity: 0.56, side: THREE.DoubleSide, roughness: 0.8 }),
      );
      ringBack.rotation.x = -Math.PI / 2;
      ringBack.rotation.z = 0.34;
      ringBack.position.y = -0.2;
      planetGroup.add(ringBack);

      const ringAccent = new THREE.Mesh(
        new THREE.RingGeometry(5.6, 6.2, 180),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
      );
      ringAccent.rotation.x = -Math.PI / 2;
      ringAccent.rotation.z = 0.34;
      ringAccent.position.y = -0.12;
      planetGroup.add(ringAccent);

      const ringFront = new THREE.Mesh(
        new THREE.RingGeometry(4.7, 8.1, 180, 1, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).lerp(new THREE.Color(0xf1d5b1), 0.48), transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.72 }),
      );
      ringFront.rotation.x = -Math.PI / 2;
      ringFront.rotation.z = 0.34;
      ringFront.position.y = 0.18;
      planetGroup.add(ringFront);

      const starPositions = new Float32Array(10000 * 3);
      for (let index = 0; index < 10000; index += 1) {
        starPositions[index * 3] = (Math.random() - 0.5) * 2000;
        starPositions[index * 3 + 1] = (Math.random() - 0.5) * 2000;
        starPositions[index * 3 + 2] = (Math.random() - 0.5) * 2000;
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, sizeAttenuation: true })));

      const starColors = new Float32Array(1500 * 3);
      const particlePositions = new Float32Array(1500 * 3);
      for (let index = 0; index < 1500; index += 1) {
        particlePositions[index * 3] = (Math.random() - 0.5) * 200;
        particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 200;
        particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 200;
        const brightness = 0.55 + Math.random() * 0.45;
        starColors[index * 3] = brightness;
        starColors[index * 3 + 1] = Math.random() * 0.3 + 0.3;
        starColors[index * 3 + 2] = Math.random() * 0.7 + 0.3;
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
      particleGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
      scene.add(new THREE.Points(particleGeometry, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.7 })));

      const orbitMessages = [...loveMessages].sort(() => Math.random() - 0.5).slice(0, 50);
      const floatingMessages = [];
      for (let index = 0; index < orbitMessages.length; index += 1) {
        const sprite = createMessageSprite(orbitMessages[index], accentHex);
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 8;
        const y = (Math.random() - 0.5) * 10;
        sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        scene.add(sprite);
        floatingMessages.push({ sprite, angle, radius, y, speed: 0.025 + (index % 5) * 0.004 });
      }
      new FontLoader().load("https://threejs.org/examples/fonts/gentilis_regular.typeface.json", (font) => {
        if (!mount.isConnected) return;
        floatingMessages.forEach((entry, index) => {
          const geometry = new TextGeometry(orbitMessages[index], { font, size: 0.4, depth: 0.1, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 3 });
          geometry.computeBoundingBox();
          geometry.center();
          const material = new THREE.MeshStandardMaterial({ color: accent, emissive: new THREE.Color(accent).multiplyScalar(0.3), emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.9 });
          const textMesh = new THREE.Mesh(geometry, material);
          textMesh.position.copy(entry.sprite.position);
          scene.remove(entry.sprite);
          entry.sprite.geometry?.dispose();
          entry.sprite.material?.map?.dispose();
          entry.sprite.material?.dispose();
          scene.add(textMesh);
          entry.sprite = textMesh;
        });
      });

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.045;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.22;
      controls.enableZoom = true;
      controls.minDistance = 13;
      controls.maxDistance = 42;
      controls.target.set(0, 0, 0);

      const resize = () => {
        if (!mount.isConnected || !renderer) return;
        const nextWidth = Math.max(mount.clientWidth, 1);
        const nextHeight = Math.max(mount.clientHeight, 1);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight);
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);

      const clock = new THREE.Clock();
      const animate = () => {
        frameId = window.requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        planet.rotation.y += 0.0018;
        planetGroup.rotation.y += 0.00045;
        floatingMessages.forEach((message, index) => {
          message.angle += 0.001 * message.speed;
          message.sprite.position.set(Math.cos(message.angle) * message.radius, message.y + Math.sin(elapsed * message.speed + index) * 1.5, Math.sin(message.angle) * message.radius);
          message.sprite.lookAt(camera.position);
        });
        fallingHeartsRef.current = fallingHeartsRef.current.filter((heart) => {
          heart.mesh.position.y -= heart.speed;
          heart.mesh.rotation.x += heart.rotation;
          heart.mesh.rotation.z += heart.rotation;
          if (heart.mesh.position.y > -10) return true;
          scene.remove(heart.mesh);
          heart.mesh.geometry.dispose();
          disposeMaterial(heart.mesh.material);
          return false;
        });
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
    } catch (error) {
      console.error("No se pudo iniciar la galaxia 3D.", error);
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      controls?.dispose();
      scene?.traverse((object) => {
        object.geometry?.dispose();
        disposeMaterial(object.material);
      });
      renderer?.dispose();
      if (renderer?.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
      setSceneUnavailable(true);
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (scene) {
        scene.traverse((object) => {
          object.geometry?.dispose();
          disposeMaterial(object.material);
        });
      }
      sceneRef.current = null;
      fallingHeartsRef.current = [];
      renderer?.dispose();
      if (renderer?.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [accent, accentHex, content.message]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(heartTimerRef.current);
    audioRef.current?.pause();
  }, []);

  const makeHeartRain = () => {
    const nextHearts = Array.from({ length: 25 }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      left: `${4 + Math.random() * 92}%`,
      delay: `${Math.random() * 0.8}s`,
      duration: `${2.1 + Math.random() * 1.8}s`,
      size: `${15 + Math.random() * 20}px`,
    }));
    setHearts(nextHearts);
    window.clearTimeout(heartTimerRef.current);
    heartTimerRef.current = window.setTimeout(() => setHearts([]), 4200);
  };

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError("");
    if (audio.paused) {
      try {
        await audio.play();
        setAudioOn(true);
      } catch {
        setAudioOn(false);
        setAudioError("No se pudo reproducir la música.");
      }
    } else {
      audio.pause();
      setAudioOn(false);
    }
  };

  const handleSceneTap = (event) => {
    if (event.target.closest("button, a, .galaxy-modal, .galaxy-gallery")) return;
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    const explosionId = Date.now();
    setExplosion({ id: explosionId, text: ["TE AMO", "ERES MÍA", "MI AMOR", "PARA SIEMPRE", "MI VIDA", "MI TODO", "MI CORAZÓN", "MI ALMA"][Math.floor(Math.random() * 8)], x: event.clientX, y: event.clientY });
    window.setTimeout(() => setExplosion((current) => current?.id === explosionId ? null : current), 1500);
    for (let index = 0; sceneRef.current && index < 10; index += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshPhongMaterial({ color: 0xff69b4, emissive: 0x990044 }));
      mesh.position.set((Math.random() - 0.5) * 20, 10 + Math.random() * 5, (Math.random() - 0.5) * 20);
      sceneRef.current.add(mesh);
      fallingHeartsRef.current.push({ mesh, speed: Math.random() * 0.05 + 0.02, rotation: Math.random() * 0.1 + 0.05 });
    }
    makeHeartRain();
    if (nextCount === 5) setTapMessage("¡Eres increíble! Cada toque es un latido de mi corazón 💕");
    else if (nextCount === 10) setTapMessage("Eres el amor de mi vida 💖");
    else if (nextCount >= 15) setTapMessage(tapMessages[Math.floor(Math.random() * tapMessages.length)]);
    if (nextCount === 1 && audioRef.current?.paused) toggleAudio();
  };

  return (
    <main className="galaxy-experience" style={{ "--galaxy-accent": accentHex }} onClick={handleSceneTap}>
      <div className="galaxy-css-stars" aria-hidden="true">{Array.from({ length: 150 }, (_, index) => <i key={index} style={{ left: `${(index * 67.37) % 100}%`, top: `${(index * 39.17) % 100}%`, "--star-delay": `${(index % 7) * -0.8}s`, "--star-duration": `${2 + (index % 5)}s` }} />)}</div>
      <div className="galaxy-moon" aria-hidden="true" />
      <div className="galaxy-scene" ref={mountRef} aria-hidden="true" />
      {sceneUnavailable && <div className="galaxy-css-fallback" aria-hidden="true"><div className="galaxy-fallback-ring" /><div className="galaxy-fallback-planet" /></div>}
      <header className="galaxy-topbar">
        <button className={`galaxy-audio-button${audioOn ? " is-on" : ""}`} type="button" onClick={toggleAudio} aria-pressed={audioOn}>
          {audioOn ? "ON" : "OFF"}
        </button>
      </header>
      <section className="galaxy-message" aria-label="Dedicatoria">
        <p className="eyebrow">{content.title}</p>
        <p className="galaxy-recipient">Para {content.recipientName}</p>
        <p className="galaxy-custom-message">{content.message}</p>
      </section>
      <p className="galaxy-scene-hint" aria-live="polite">{tapMessage || "Toca la pantalla mi amor 💕"}</p>
      <div className="galaxy-gallery" aria-label="Galería de recuerdos">
        {galleryItems.map((item, index) => (
          <button className="galaxy-gallery-item" type="button" key={item.src} onClick={() => setSelectedImage(item)} aria-label={`Abrir recuerdo ${index + 1}`}>
            <img src={item.src} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.opacity = "0"; }} />
            <span>{String(index + 1).padStart(2, "0")}</span>
          </button>
        ))}
      </div>
      {audioError && <p className="galaxy-audio-error" role="status">{audioError}</p>}
      <audio ref={audioRef} loop preload="none">
        <source src="https://bcodestorague.anteroteobaldob.workers.dev/share/anteroteobaldob_gmail_com/AUDIO/en%20saturno.mp3" type="audio/mpeg" />
      </audio>
      <div className="galaxy-hearts" aria-hidden="true">
        {hearts.map((heart) => <span key={heart.id} style={{ left: heart.left, animationDelay: heart.delay, animationDuration: heart.duration, fontSize: heart.size }}>♥</span>)}
      </div>
      {explosion && <span className="galaxy-tap-explosion" style={{ left: explosion.x, top: explosion.y }}>{explosion.text}</span>}
      {selectedImage && (
        <div className="galaxy-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedImage(null); }}>
          <section className="galaxy-modal-content" role="dialog" aria-modal="true" aria-label="Recuerdo">
            <button className="galaxy-modal-close" type="button" onClick={() => setSelectedImage(null)} aria-label="Cerrar recuerdo">×</button>
            <img src={selectedImage.src} alt={selectedImage.alt} />
            <p>{selectedImage.message}</p>
          </section>
        </div>
      )}
    </main>
  );
}
