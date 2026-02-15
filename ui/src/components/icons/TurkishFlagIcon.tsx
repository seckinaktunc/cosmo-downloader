export function TurkishFlagIcon({ size }: { size: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 512 512"
        >
            <mask id="a">
                <circle cx={256} cy={256} r={256} fill="#fff" />
            </mask>
            <g mask="url(#a)">
                <path fill="#d80027" d="M0 0h512v512H0z" />
                <g fill="#eee">
                    <path d="M350 182l33 46 54-18-33 46 33 46-54-18-33 46v-57l-54-17 54-18z" />
                    <path d="M260 370a114 114 0 1154-215 141 141 0 100 202c-17 9-35 13-54 13" />
                </g>
            </g>
        </svg>
    );
};