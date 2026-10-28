import { useRef, useState } from "react";
import { createUseStyles } from "react-jss";
import { register } from "../../services/auth";
import useButtonStyles from "../../styles/buttonStyles";
import ActionButton from "../actionButton";

const useStyles = createUseStyles({
    header: {
        fontSize: '35px',
    },
    input: {
        width: 'calc(100% - 130px)',
        display: 'inline-block',
    },
    inputLabel: {
        width: '130px',
        display: 'inline-block',
        color: '#343434',
    },
    signUpButtonWrapper: {
        float: 'right',
    },
    formWrapper: {
        maxWidth: '400px',
    },
});

const SignUpArea = props => {
    const buttonStyles = useButtonStyles();
    const s = useStyles();
    const usernameRef = useRef(null);
    const passwordRef = useRef(null);
    const confirmRef = useRef(null);
    const [locked, setLocked] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const onSignUpClick = e => {
        setFeedback(null);
        const username = usernameRef.current.value;
        const password = passwordRef.current.value;
        if (password !== confirmRef.current.value) {
            setFeedback('Passwords do not match.');
            return;
        }
        setLocked(true);
        register({ username, password }).then(() => {
            window.location.href = '/home';
        }).catch(e => {
            setFeedback(e.response?.data?.errors[0]?.message || e.message);
        }).finally(() => {
            setLocked(false);
        })
    }

    return <div className='row'>
        <div className='col-12'>
            <h1 className={s.header}>Sign Up to Build & Make Friends</h1>
            {feedback && <p className='mb-2 mt-1 text-danger'>{feedback}</p>}
        </div>
        <div className='col-12'>
            <div className={'ms-4 me-4 ' + s.formWrapper}>
                <div>
                    <div className={s.inputLabel}>
                        <p className='fw-bold me-4'>Username:</p>
                    </div>
                    <div className={s.input}>
                        <input disabled={locked} type='text' className='w-100' ref={usernameRef}></input>
                    </div>
                </div>
                <div className='mt-2'>
                    <div className={s.inputLabel}>
                        <p className='fw-bold me-4'>Password:</p>
                    </div>
                    <div className={s.input}>
                        <input disabled={locked} type='password' className='w-100' ref={passwordRef}></input>
                    </div>
                </div>
                <div className='mt-2'>
                    <div className={s.inputLabel}>
                        <p className='fw-bold me-4'>Confirm Password:</p>
                    </div>
                    <div className={s.input}>
                        <input disabled={locked} type='password' className='w-100' ref={confirmRef}></input>
                    </div>
                </div>
                <div className='mt-3'>
                    <div className={s.signUpButtonWrapper}>
                        <ActionButton disabled={locked} label='Sign Up' className={buttonStyles.continueButton} onClick={onSignUpClick}></ActionButton>
                    </div>
                </div>
            </div>
        </div>
    </div>
}

export default SignUpArea;
