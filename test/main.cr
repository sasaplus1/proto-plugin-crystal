require "http/client"
require "webmock"

WebMock.stub(:get, "http://example.com/").
  to_return(body: "Hello World", status: 200)

response = HTTP::Client.get "http://example.com"
puts response.body
