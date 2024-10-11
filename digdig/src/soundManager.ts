export class SoundManager {
    private audioContext: AudioContext;
    private angryBeeBuzzNode: OscillatorNode | null = null;
    private beeBuzzGainNode: GainNode | null = null;
    private masterGainNode: GainNode;
    private isMuted: boolean = false;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.connect(this.audioContext.destination);
        this.setVolume(0.5); // Set default volume to 50%
    }

    public setMute(mute: boolean): void {
        this.isMuted = mute;
        if (this.isMuted) {
            this.masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        } else {
            this.masterGainNode.gain.setValueAtTime(this.getVolume(), this.audioContext.currentTime);
        }
        
        // Stop the bee sound if it's playing and we're muting
        if (this.isMuted && this.angryBeeBuzzNode) {
            this.stopAngryBeeSound();
        }
    }

    public setVolume(volume: number) {
        if (volume < 0 || volume > 1) {
            throw new Error('Volume must be between 0 and 1');
        }
        if (!this.isMuted) {
            this.masterGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }

    public getVolume(): number {
        return this.masterGainNode.gain.value;
    }

    public playCollectSound() {
        this.playSound(440, 0.1, 'sine');
    }

    public playHurtSound() {
        this.playSound(100, 0.2, 'sawtooth');
    }

    public playPortalSound() {
        this.playSweep(300, 600, 0.3);
    }

    public playBackgroundMusic() {
        this.playAmbientSound();
    }

    public playGoldDigSound() {
        this.playSound(660, 0.1, 'sine'); // Higher pitch for gold
    }

    public playBuyEmoteSound() {
        this.playSweep(440, 880, 0.2); // Upward sweep for purchase
    }

    public playAngryBeeSound() {
        if (this.isMuted) return; // Don't play if muted
        console.log("Playing angry bee sound");
        if (this.angryBeeBuzzNode) {
            this.stopAngryBeeSound();
        }
        this.startContinuousBuzz();
    }

    public stopAngryBeeSound() {
        if (this.angryBeeBuzzNode) {
            this.angryBeeBuzzNode.stop();
            this.angryBeeBuzzNode.disconnect();
            this.angryBeeBuzzNode = null;
        }
        if (this.beeBuzzGainNode) {
            this.beeBuzzGainNode.disconnect();
            this.beeBuzzGainNode = null;
        }
    }

    private startContinuousBuzz() {
        const fundamentalFreq = 100; // Base frequency at 100 Hz
        const maxFreq = 150; // Maximum frequency for harmonics
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sawtooth'; // Use sawtooth for a richer harmonic content
        oscillator.frequency.setValueAtTime(fundamentalFreq, this.audioContext.currentTime);

        // Create a slight wobble effect for the fundamental frequency
        this.addFrequencyModulation(oscillator, 8, 2);

        // Add harmonics, but limit their frequency to maxFreq
        this.addHarmonic(oscillator, 2, 0.5, maxFreq); // Second harmonic
        this.addHarmonic(oscillator, 3, 0.3, maxFreq); // Third harmonic
        this.addHarmonic(oscillator, 4, 0.2, maxFreq); // Fourth harmonic

        oscillator.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        // Increase the volume to match other sounds
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.1, this.audioContext.currentTime + 0.1); // Increased from 0.02 to 0.1

        oscillator.start();

        this.angryBeeBuzzNode = oscillator;
        this.beeBuzzGainNode = gainNode;

        // Add amplitude modulation for a more natural buzz
        this.addAmplitudeModulation(gainNode);
    }

    private addFrequencyModulation(oscillator: OscillatorNode, modulationFreq: number, modulationAmount: number) {
        const modulator = this.audioContext.createOscillator();
        const modulationIndex = this.audioContext.createGain();

        modulator.frequency.setValueAtTime(modulationFreq, this.audioContext.currentTime);
        modulationIndex.gain.setValueAtTime(modulationAmount, this.audioContext.currentTime);

        modulator.connect(modulationIndex);
        modulationIndex.connect(oscillator.frequency);

        modulator.start();
    }

    private addHarmonic(fundamentalOscillator: OscillatorNode, harmonicNumber: number, gainValue: number, maxFreq: number) {
        const harmonicOscillator = this.audioContext.createOscillator();
        const harmonicGain = this.audioContext.createGain();

        harmonicOscillator.type = 'sawtooth';
        const harmonicFreq = Math.min(fundamentalOscillator.frequency.value * harmonicNumber, maxFreq);
        harmonicOscillator.frequency.setValueAtTime(harmonicFreq, this.audioContext.currentTime);
        harmonicGain.gain.setValueAtTime(gainValue, this.audioContext.currentTime);

        harmonicOscillator.connect(harmonicGain);
        harmonicGain.connect(this.masterGainNode);

        harmonicOscillator.start();
    }

    private addAmplitudeModulation(gainNode: GainNode) {
        const modulator = this.audioContext.createOscillator();
        const modulatorGain = this.audioContext.createGain();

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(30, this.audioContext.currentTime);

        modulatorGain.gain.setValueAtTime(0.3, this.audioContext.currentTime); // Increased from 0.1 to 0.3

        modulator.connect(modulatorGain);
        modulatorGain.connect(gainNode.gain);

        modulator.start();
    }

    private playSound(frequency: number, duration: number, type: OscillatorType) {
        if (this.isMuted) return; // Don't play if muted
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        // Reduce the volume here
        gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime); // Changed from 0.1 to 0.05
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    private playSweep(startFreq: number, endFreq: number, duration: number) {
        if (this.isMuted) return; // Don't play if muted
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + duration);
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    private playAmbientSound() {
        if (this.isMuted) return; // Don't play if muted
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(50, this.audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        // Reduce the volume of the ambient sound
        gainNode.gain.setValueAtTime(0.01, this.audioContext.currentTime); // Changed from 0.02 to 0.01

        oscillator.start();

        // Modulate the frequency slightly for an ambient effect
        setInterval(() => {
            const newFreq = 45 + Math.random() * 10;
            oscillator.frequency.exponentialRampToValueAtTime(newFreq, this.audioContext.currentTime + 2);
        }, 2000);
    }

    private playBuzzSound(baseFreq: number, maxFreq: number, duration: number) {
        if (this.isMuted) return; // Don't play if muted
        const oscillator1 = this.audioContext.createOscillator();
        const oscillator2 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator1.type = 'sawtooth';
        oscillator2.type = 'triangle';

        // Create a buzzing effect by rapidly alternating between two frequencies
        const lfoFreq = 30; // Frequency of oscillation between base and max frequency
        const now = this.audioContext.currentTime;

        oscillator1.frequency.setValueAtTime(baseFreq, now);
        oscillator2.frequency.setValueAtTime(baseFreq * 1.01, now); // Slightly detuned for richer sound

        oscillator1.frequency.setValueCurveAtTime(
            new Float32Array([baseFreq, maxFreq, baseFreq]),
            now,
            duration
        );
        oscillator2.frequency.setValueCurveAtTime(
            new Float32Array([baseFreq * 1.01, maxFreq * 1.01, baseFreq * 1.01]),
            now,
            duration
        );

        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + duration * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.1, now + duration);

        oscillator1.start(now);
        oscillator2.start(now);
        oscillator1.stop(now + duration);
        oscillator2.stop(now + duration);
    }
}