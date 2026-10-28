#include "queue.h"
#include <stdlib.h>

int queue_push(struct Queue *q, int value) {
    if (!q || value < 0) {
        return -1;
    }
    q->size++;
    return q->size;
}
