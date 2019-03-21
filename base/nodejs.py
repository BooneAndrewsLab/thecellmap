from require.environments import Environment

class NodeJSEnvironment(Environment):
    def args(self):
        return ['node`']