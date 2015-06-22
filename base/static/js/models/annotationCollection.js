define([
  'underscore',
  'backbone',
  'annotationModel'
], function(_, Backbone, Annotation) {
    var AnnotationCollection = Backbone.Collection.extend({
        model: Annotation
    });
    
    return AnnotationCollection;
});