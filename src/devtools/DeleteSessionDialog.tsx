import './App.css';
import {
    Button, Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText,
} from '@mui/material';
import { Session } from './types'

interface Props {
    open: boolean
    session: Session
    confirm(session: Session): void
    close(): void
}

export default function DeleteSessionDialog(props: Props) {
    const handleDelete = () => {
        props.confirm(props.session)
    }
    return (
        <Dialog open={props.open} onClose={props.close}>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Are you sure you want to delete <strong>[{props.session.name}]</strong>?
                    This action cannot be undone and all messages in this session will be permanently lost.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.close}>Cancel</Button>
                <Button onClick={handleDelete} color="error">Delete</Button>
            </DialogActions>
        </Dialog>
    )
}
