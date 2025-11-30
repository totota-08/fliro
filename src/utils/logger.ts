import { useNotificationCenter } from '@/composables/useNotificationCenter'
import { configure, getConsoleSink, type LogRecord } from '@logtape/logtape'

const { sendNotification } = useNotificationCenter()

/**
 * Custom sink that sends error logs to the notification center (Toast).
 */
function notificationSink(record: LogRecord) {
    if (record.level === 'error' || record.level === 'fatal') {
        // Format the message for the toast
        let message = ''
        if (typeof record.message === 'string') {
            message = record.message
        } else {
            // Handle template literal messages or other objects
            message = record.message.map(String).join('')
        }

        sendNotification('critical', `Error: ${message}`)
    }
}

export async function initLogger() {
    await configure({
        sinks: {
            console: getConsoleSink(),
            notification: notificationSink,
        },
        loggers: [
            { category: 'app', sinks: ['console', 'notification'] },
            { category: 'logtape', sinks: ['console'], level: 'warning' } as any,
        ],
    })
}
