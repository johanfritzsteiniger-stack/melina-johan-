"use client";

// Kaffeemaschinen-Geräusch, komplett im Browser erzeugt (keine Sounddatei):
// Mahlwerk → Pumpe/Brühen mit Zischen → ein paar Tropfen. Dauer ca. 2,6 s.

let ctx: AudioContext | null = null;

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(g: GainNode, t: number, attack: number, hold: number, release: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

/** Muss direkt aus einem Klick heraus aufgerufen werden (sonst blockt iOS den Ton). */
export function playCoffeeSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const ac = ctx;
    if (ac.state === "suspended") void ac.resume();

    const master = ac.createGain();
    master.gain.value = 0.32;
    master.connect(ac.destination);
    const t0 = ac.currentTime + 0.02;
    const noise = noiseBuffer(ac, 3);

    // 1) Mahlwerk: rauer Motor + knirschendes Rauschen, leicht schwankend
    const motor = ac.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.setValueAtTime(95, t0);
    motor.frequency.linearRampToValueAtTime(125, t0 + 0.15);
    motor.frequency.linearRampToValueAtTime(115, t0 + 0.85);
    const wobble = ac.createOscillator();
    wobble.frequency.value = 23;
    const wobbleGain = ac.createGain();
    wobbleGain.gain.value = 6;
    wobble.connect(wobbleGain).connect(motor.frequency);
    const motorFilter = ac.createBiquadFilter();
    motorFilter.type = "lowpass";
    motorFilter.frequency.value = 900;
    const motorGain = ac.createGain();
    envelope(motorGain, t0, 0.05, 0.7, 0.15, 0.35);
    motor.connect(motorFilter).connect(motorGain).connect(master);

    const grind = ac.createBufferSource();
    grind.buffer = noise;
    const grindFilter = ac.createBiquadFilter();
    grindFilter.type = "bandpass";
    grindFilter.frequency.value = 2200;
    grindFilter.Q.value = 1.2;
    const grindGain = ac.createGain();
    envelope(grindGain, t0, 0.05, 0.7, 0.15, 0.25);
    // knirschen: schnelle Lautstärke-Schwankung
    const crunch = ac.createOscillator();
    crunch.type = "square";
    crunch.frequency.value = 31;
    const crunchGain = ac.createGain();
    crunchGain.gain.value = 0.1;
    crunch.connect(crunchGain).connect(grindGain.gain);
    grind.connect(grindFilter).connect(grindGain).connect(master);

    // 2) Pumpe: tiefes Brummen
    const t1 = t0 + 0.95;
    const pump = ac.createOscillator();
    pump.type = "square";
    pump.frequency.value = 50;
    const pumpFilter = ac.createBiquadFilter();
    pumpFilter.type = "lowpass";
    pumpFilter.frequency.value = 220;
    const pumpGain = ac.createGain();
    envelope(pumpGain, t1, 0.08, 1.0, 0.3, 0.3);
    pump.connect(pumpFilter).connect(pumpGain).connect(master);

    // Brühen/Gurgeln: Rauschen durch einen wandernden Filter
    const brew = ac.createBufferSource();
    brew.buffer = noise;
    const brewFilter = ac.createBiquadFilter();
    brewFilter.type = "bandpass";
    brewFilter.Q.value = 6;
    for (let i = 0; i < 14; i++) {
      brewFilter.frequency.setValueAtTime(350 + Math.random() * 700, t1 + i * 0.09);
    }
    const brewGain = ac.createGain();
    envelope(brewGain, t1 + 0.1, 0.1, 0.9, 0.3, 0.35);
    brew.connect(brewFilter).connect(brewGain).connect(master);

    // Dampf-Zischen
    const steam = ac.createBufferSource();
    steam.buffer = noise;
    const steamFilter = ac.createBiquadFilter();
    steamFilter.type = "highpass";
    steamFilter.frequency.value = 4000;
    const steamGain = ac.createGain();
    envelope(steamGain, t1 + 0.4, 0.15, 0.5, 0.5, 0.12);
    steam.connect(steamFilter).connect(steamGain).connect(master);

    // 3) Tropfen
    for (const dt of [1.55, 1.85, 2.1, 2.35]) {
      const t = t0 + dt;
      const drop = ac.createOscillator();
      drop.type = "sine";
      drop.frequency.setValueAtTime(1400 + Math.random() * 300, t);
      drop.frequency.exponentialRampToValueAtTime(500, t + 0.08);
      const dropGain = ac.createGain();
      envelope(dropGain, t, 0.005, 0.01, 0.09, 0.25);
      drop.connect(dropGain).connect(master);
      drop.start(t);
      drop.stop(t + 0.15);
    }

    const end = t0 + 2.7;
    for (const src of [motor, wobble, crunch, pump]) {
      src.start(t0);
      src.stop(end);
    }
    grind.start(t0);
    grind.stop(t0 + 1);
    brew.start(t1);
    brew.stop(end);
    steam.start(t1);
    steam.stop(end);
  } catch {
    // Ton ist nur Zusatz
  }
}
