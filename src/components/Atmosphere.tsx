import styles from './Atmosphere.module.css';

interface AtmosphereProps {
    theme: 'void' | 'dark' | 'flux';
}

export default function Atmosphere({ theme }: AtmosphereProps) {
    return (
        <div className={styles.atmosphere} data-theme={theme}>
            {theme === 'void' && (
                <div className={styles.voidContainer}>
                    <div className={styles.breathingGradient} />
                    <div className={styles.staticNoise} />
                </div>
            )}
            {theme === 'dark' && (
                <div className={styles.darkContainer}>
                    <div className={styles.spotlight} />
                    <div className={styles.softGlow} />
                </div>
            )}
            {theme === 'flux' && (
                <div className={styles.fluxContainer}>
                    <div className={styles.particles} />
                    <div className={styles.digitalVeins} />
                    <div className={styles.scanline} />
                </div>
            )}
        </div>
    );
}
