#include "../include/queue.h"
#include <vector>

namespace jobs {
class Worker {
 public:
  int run(Queue *q);
};
}

int jobs::Worker::run(Queue *q) {
  return queue_push(q, 1);
}
