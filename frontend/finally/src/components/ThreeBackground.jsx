import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './ThreeBackground.css';

const ThreeBackground = () => {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const rendererRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const particleCount = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 60;
      positions[i3 + 1] = (Math.random() - 0.5) * 40;
      positions[i3 + 2] = (Math.random() - 0.5) * 30;
      velocities[i3] = (Math.random() - 0.5) * 0.008;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.008;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.004;
      sizes[i] = Math.random() * 3.5 + 1.0;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uColor: { value: new THREE.Color(0x0466C8) },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aSize;
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vDist;

        void main() {
          vec3 pos = position;

          pos.x += sin(pos.y * 0.3 + uTime * 0.4) * 0.5;
          pos.y += cos(pos.x * 0.2 + uTime * 0.3) * 0.4;

          float mouseInfluence = 1.0 - smoothstep(0.0, 15.0, length(pos.xy - uMouse * 20.0));
          pos.x += uMouse.x * mouseInfluence * 3.0;
          pos.y += uMouse.y * mouseInfluence * 2.0;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float sizeAttenuation = 300.0 / -mvPosition.z;
          gl_PointSize = aSize * sizeAttenuation * uPixelRatio;

          vAlpha = 0.5 + mouseInfluence * 0.5;
          vDist = length(pos.xy) / 30.0;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        varying float vDist;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 2.0);

          float alpha = vAlpha * glow * (1.0 - vDist * 0.5);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const maxConnections = 600;
    const linePositions = new Float32Array(maxConnections * 6);
    const lineAlphas = new Float32Array(maxConnections * 2);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(lineAlphas, 1));

    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x0466C8) },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * 0.35);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    const ringGroup = new THREE.Group();
    const ringRadii = [8, 13, 19];
    const ringMeshes = [];

    ringRadii.forEach((r, idx) => {
      const ringGeom = new THREE.RingGeometry(r - 0.02, r + 0.02, 128);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x0466C8,
        transparent: true,
        opacity: 0.07 + idx * 0.02,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI * 0.5 + idx * 0.15;
      ring.rotation.y = idx * 0.3;
      ringMeshes.push(ring);
      ringGroup.add(ring);
    });

    scene.add(ringGroup);

    const clock = new THREE.Clock();
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.05;
      m.y += (m.targetY - m.y) * 0.05;

      particleMaterial.uniforms.uTime.value = elapsed;
      particleMaterial.uniforms.uMouse.value.set(m.x, m.y);

      const pos = particleGeometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        pos[i3] += velocities[i3];
        pos[i3 + 1] += velocities[i3 + 1];
        pos[i3 + 2] += velocities[i3 + 2];

        if (Math.abs(pos[i3]) > 30) velocities[i3] *= -1;
        if (Math.abs(pos[i3 + 1]) > 20) velocities[i3 + 1] *= -1;
        if (Math.abs(pos[i3 + 2]) > 15) velocities[i3 + 2] *= -1;
      }
      particleGeometry.attributes.position.needsUpdate = true;

      let lineIdx = 0;
      const connectionDist = 8;
      const lPos = lineGeometry.attributes.position.array;
      const lAlpha = lineGeometry.attributes.aAlpha.array;

      for (let i = 0; i < particleCount && lineIdx < maxConnections; i++) {
        for (let j = i + 1; j < particleCount && lineIdx < maxConnections; j++) {
          const i3 = i * 3;
          const j3 = j * 3;
          const dx = pos[i3] - pos[j3];
          const dy = pos[i3 + 1] - pos[j3 + 1];
          const dz = pos[i3 + 2] - pos[j3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectionDist) {
            const li = lineIdx * 6;
            lPos[li] = pos[i3];
            lPos[li + 1] = pos[i3 + 1];
            lPos[li + 2] = pos[i3 + 2];
            lPos[li + 3] = pos[j3];
            lPos[li + 4] = pos[j3 + 1];
            lPos[li + 5] = pos[j3 + 2];

            const alpha = 1 - dist / connectionDist;
            lAlpha[lineIdx * 2] = alpha;
            lAlpha[lineIdx * 2 + 1] = alpha;
            lineIdx++;
          }
        }
      }

      for (let i = lineIdx; i < maxConnections; i++) {
        const li = i * 6;
        lPos[li] = lPos[li + 1] = lPos[li + 2] = 0;
        lPos[li + 3] = lPos[li + 4] = lPos[li + 5] = 0;
        lAlpha[i * 2] = 0;
        lAlpha[i * 2 + 1] = 0;
      }

      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.aAlpha.needsUpdate = true;
      lineGeometry.setDrawRange(0, lineIdx * 2);

      ringMeshes.forEach((ring, idx) => {
        ring.rotation.z = elapsed * 0.05 * (idx % 2 === 0 ? 1 : -1);
        ring.rotation.x += m.y * 0.005;
        ring.rotation.y += m.x * 0.005;
      });

      camera.position.x = m.x * 2;
      camera.position.y = m.y * 1.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    const handleMouseMove = (e) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      particleGeometry.dispose();
      particleMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      ringMeshes.forEach((r) => {
        r.geometry.dispose();
        r.material.dispose();
      });
    };
  }, []);

  return <div className="three-bg" ref={containerRef} />;
};

export default ThreeBackground;
