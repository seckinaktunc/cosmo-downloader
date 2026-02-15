import { type MouseEvent } from 'react';
import { postWebViewMessage } from '@/lib/webview';
import { useLocale } from '@/locale';
import { useGlobalStore } from '@/stores/globalStore';
import Box from '@/components/ui/Box';
import Button from '@/components/Button';

export default function WindowBar() {
    const { locale } = useLocale();
    const setVisible = useGlobalStore((state) => state.setVisible);
    const setExitAction = useGlobalStore((state) => state.setExitAction);

    const isPinned = useGlobalStore((state) => state.isPinned);
    const togglePin = useGlobalStore((state) => state.togglePin);

    const handleDrag = (event: MouseEvent<HTMLDivElement>) => {
        if (event.button === 0) {
            postWebViewMessage("start_drag");
        }
    };

    const handleMinimize = () => {
        setExitAction('minimize');
        setVisible(false);
    };

    const handleClose = () => {
        setExitAction('close');
        setVisible(false);
    };

    return (
        <Box
            className='grid grid-cols-3'
            onMouseDown={handleDrag}
        >
            <div className="flex gap-2">
                <Button
                    variant="secondary"
                    ghost={isPinned ? false : true}
                    isIcon
                    icon={isPinned ? "pinFilled" : "pin"}
                    iconSize={16}
                    className='w-7 h-7'
                    onClick={togglePin}
                    active={isPinned}
                    stopPropagation
                />
            </div>
            <div className='flex justify-center items-center gap-3 opacity-50 hover:opacity-100'>
                <img src='/icon.ico' className='max-h-5' />
                <span className="text-sm text-nowrap">{locale.windowBar.title}</span>
            </div>
            <div className="flex justify-end gap-1.5 p-1">
                <Button
                    variant="secondary"
                    isIcon
                    size="xs"
                    className="bg-yellow"
                    onClick={handleMinimize}
                    ghost
                    stopPropagation
                />
                <Button
                    variant="secondary"
                    isIcon
                    iconSize={12}
                    size="xs"
                    className="bg-primary"
                    onClick={handleClose}
                    ghost
                    stopPropagation
                />
            </div>
        </Box>
    )
}
