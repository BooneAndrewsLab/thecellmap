#!/bin/bash

svn up
python manage.py collectstatic
sudo supervisorctl restart uwsgi
sudo /etc/init.d/memcached restart